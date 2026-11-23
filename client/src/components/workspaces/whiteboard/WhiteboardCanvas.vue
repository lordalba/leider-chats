<template>
  <div class="whiteboard">
    <div class="toolbar">
      <!-- Tools -->
      <div class="group">
        <button
          v-for="t in tools"
          :key="t.id"
          class="tool"
          :class="{ active: tool === t.id }"
          :title="t.label"
          :aria-label="t.label"
          @click="tool = t.id"
        >
          <i :class="t.icon"></i>
        </button>
      </div>

      <!-- Colours (hidden for the eraser, which always paints the board colour) -->
      <div v-if="tool !== 'eraser'" class="group">
        <button
          v-for="c in colors"
          :key="c"
          class="swatch"
          :class="{ active: color === c }"
          :style="{ backgroundColor: c }"
          :title="c"
          @click="color = c"
        ></button>
        <label class="custom-color" title="Pick any colour">
          <input v-model="color" type="color" />
          <i class="fa-solid fa-palette"></i>
        </label>
      </div>

      <!-- Sizes -->
      <div class="group">
        <button
          v-for="w in currentWidths"
          :key="w.value"
          class="width"
          :class="{ active: width === w.value }"
          :title="w.label"
          @click="width = w.value"
        >
          <span class="dot" :style="{ width: Math.min(w.value, 22) + 4 + 'px', height: Math.min(w.value, 22) + 4 + 'px' }"></span>
        </button>
      </div>

      <!-- Actions -->
      <div class="group">
        <button class="action" :disabled="myStrokeIds.length === 0" title="Undo my last stroke (Ctrl+Z)" @click="undo">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
        <button class="action" :disabled="redoStack.length === 0" title="Redo (Ctrl+Y)" @click="redo">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
        <button class="action" title="Download as image" @click="download">
          <i class="fa-solid fa-download"></i>
        </button>
        <button v-if="canClear" class="action danger" title="Clear board for everyone" @click="confirmClear = true">
          <i class="fa-solid fa-trash"></i> Clear
        </button>
      </div>
      <span v-if="!ready" class="status"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</span>
    </div>

    <div ref="surface" class="surface">
      <canvas ref="base" class="layer"></canvas>
      <canvas
        ref="overlay"
        class="layer overlay"
        :class="{ erasing: tool === 'eraser' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      ></canvas>
    </div>

    <ConfirmationModal
      v-if="confirmClear"
      title="Clear board"
      description="Remove every stroke from this whiteboard for everyone?"
      confirm-text="Clear"
      cancel-text="Cancel"
      :on-confirm="clear"
      :on-cancel="() => (confirmClear = false)"
    />
  </div>
</template>

<script>
import ConfirmationModal from "@/components/common/ConfirmationModal.vue";
import { drawStroke, normalizePoint, simplifyPoints, MAX_POINT_NUMBERS } from "@/workspaces/strokes";
import { emitWithAck, errorMessage } from "@/socket/socketCall";

const DRAWING_THROTTLE_MS = 50;
const BOARD_COLOR = "#ffffff";
const MAX_SERVER_WIDTH = 40;

const newStrokeId = () =>
  window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Points for a straight line or rectangle between two corners. */
const shapePoints = (tool, [x0, y0], [x1, y1]) => {
  if (tool === "line") return [x0, y0, x1, y1];
  return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
};

export default {
  name: "WhiteboardCanvas",
  components: { ConfirmationModal },
  props: {
    whiteboardId: { type: String, required: true },
    connectedUser: { type: Object, required: true },
    /** The board's creator id and the chat admins decide who may clear it. */
    createdBy: { type: String, default: "" },
    chatAdmins: { type: Array, default: () => [] },
  },
  data() {
    return {
      tools: [
        { id: "pen", label: "Pen", icon: "fa-solid fa-pen" },
        { id: "eraser", label: "Eraser", icon: "fa-solid fa-eraser" },
        { id: "line", label: "Straight line", icon: "fa-solid fa-slash" },
        { id: "rect", label: "Rectangle", icon: "fa-regular fa-square" },
      ],
      tool: "pen",
      colors: ["#222222", "#e6194b", "#4363d8", "#3cb44b", "#f58231", "#911eb4"],
      widths: [
        { value: 2, label: "Thin" },
        { value: 6, label: "Medium" },
        { value: 14, label: "Thick" },
      ],
      eraserWidths: [
        { value: 12, label: "Small eraser" },
        { value: 24, label: "Medium eraser" },
        { value: 40, label: "Large eraser" },
      ],
      color: "#222222",
      width: 6,
      penWidth: 6,
      eraserWidth: 24,
      ready: false,
      confirmClear: false,
      myStrokeIds: [],
      redoStack: [],
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    myId() {
      return String(this.connectedUser._id);
    },
    canClear() {
      return this.createdBy === this.myId || this.chatAdmins.map(String).includes(this.myId);
    },
    currentWidths() {
      return this.tool === "eraser" ? this.eraserWidths : this.widths;
    },
  },
  watch: {
    tool(next, prev) {
      // Each tool remembers its own size.
      if (prev === "eraser") this.eraserWidth = this.width;
      else this.penWidth = this.width;
      this.width = next === "eraser" ? this.eraserWidth : this.penWidth;
    },
  },
  mounted() {
    // Non-reactive drawing state.
    this.strokes = [];
    this.remoteDrawing = new Map(); // strokeId -> in-progress stroke from someone else
    this.current = null;
    this.startPoint = null;
    this.lastDrawingEmit = 0;
    this.size = { width: 0, height: 0 };
    this.resizeFrame = null;

    this.handlers = {
      "wb:stroke": ({ whiteboardId, stroke }) => {
        if (whiteboardId !== this.whiteboardId) return;
        this.remoteDrawing.delete(stroke.id);
        this.addStroke(stroke);
        this.redrawOverlay();
      },
      "wb:drawing": (payload) => {
        if (payload.whiteboardId !== this.whiteboardId) return;
        this.remoteDrawing.set(payload.strokeId, payload);
        this.redrawOverlay();
      },
      "wb:stroke-removed": ({ whiteboardId, strokeId }) => {
        if (whiteboardId !== this.whiteboardId) return;
        this.strokes = this.strokes.filter((s) => s.id !== strokeId);
        this.myStrokeIds = this.myStrokeIds.filter((id) => id !== strokeId);
        this.redrawBase();
      },
      "wb:cleared": ({ whiteboardId }) => {
        if (whiteboardId !== this.whiteboardId) return;
        this.strokes = [];
        this.myStrokeIds = [];
        this.redoStack = [];
        this.remoteDrawing.clear();
        this.redrawBase();
        this.redrawOverlay();
      },
      connect: () => this.open(),
    };
    Object.entries(this.handlers).forEach(([event, fn]) => this.socket.on(event, fn));

    // The board's height comes from CSS (aspect-ratio), so resizing the canvases here
    // never changes the observed element's size: no ResizeObserver feedback loop.
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(this.$refs.surface);
    this.onKeyDown = (event) => this.handleShortcut(event);
    window.addEventListener("keydown", this.onKeyDown);
    this.resize();
    this.open();
  },
  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.socket) {
      Object.entries(this.handlers).forEach(([event, fn]) => this.socket.off(event, fn));
      emitWithAck(this.socket, "wb:close", this.whiteboardId).catch(() => {});
    }
  },
  methods: {
    async open() {
      this.ready = false;
      try {
        const { strokes } = await emitWithAck(this.socket, "wb:open", this.whiteboardId);
        this.strokes = strokes;
        this.myStrokeIds = strokes.filter((s) => s.userId === this.myId).map((s) => s.id);
        this.redoStack = [];
        this.ready = true;
        this.redrawBase();
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
    addStroke(stroke) {
      if (this.strokes.some((s) => s.id === stroke.id)) return;
      this.strokes.push(stroke);
      const ctx = this.$refs.base.getContext("2d");
      drawStroke(ctx, stroke, this.size.width, this.size.height);
    },
    scheduleResize() {
      if (this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = null;
        this.resize();
      });
    },
    resize() {
      const surface = this.$refs.surface;
      if (!surface) return;
      const width = surface.clientWidth;
      const height = surface.clientHeight;
      if (!width || !height) return;
      if (width === this.size.width && height === this.size.height) return;
      const dpr = window.devicePixelRatio || 1;
      this.size = { width, height };
      [this.$refs.base, this.$refs.overlay].forEach((canvas) => {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      });
      this.redrawBase();
      this.redrawOverlay();
    },
    redrawBase() {
      const ctx = this.$refs.base && this.$refs.base.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, this.size.width, this.size.height);
      this.strokes.forEach((s) => drawStroke(ctx, s, this.size.width, this.size.height));
    },
    redrawOverlay() {
      const ctx = this.$refs.overlay && this.$refs.overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, this.size.width, this.size.height);
      this.remoteDrawing.forEach((s) => drawStroke(ctx, s, this.size.width, this.size.height));
      if (this.current) drawStroke(ctx, this.current, this.size.width, this.size.height);
    },
    pointFrom(event) {
      const rect = this.$refs.overlay.getBoundingClientRect();
      return normalizePoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    },
    onPointerDown(event) {
      if (!this.ready || event.button > 0) return;
      event.target.setPointerCapture(event.pointerId);
      const point = this.pointFrom(event);
      this.startPoint = point;
      this.current = {
        id: newStrokeId(),
        color: this.tool === "eraser" ? BOARD_COLOR : this.color,
        width: Math.min(this.width, MAX_SERVER_WIDTH),
        points: [point[0], point[1]],
      };
      this.redrawOverlay();
    },
    onPointerMove(event) {
      if (!this.current) return;
      const point = this.pointFrom(event);
      if (this.tool === "line" || this.tool === "rect") {
        this.current.points = shapePoints(this.tool, this.startPoint, point);
      } else if (this.current.points.length < MAX_POINT_NUMBERS * 5) {
        // Keep the raw stroke bounded; it is simplified on pointer-up.
        this.current.points.push(point[0], point[1]);
      }
      this.redrawOverlay();

      const now = Date.now();
      if (now - this.lastDrawingEmit >= DRAWING_THROTTLE_MS) {
        this.lastDrawingEmit = now;
        this.socket.emit("wb:drawing", this.whiteboardId, {
          strokeId: this.current.id,
          color: this.current.color,
          width: this.current.width,
          points: simplifyPoints(this.current.points),
        });
      }
    },
    async onPointerUp() {
      const draft = this.current;
      this.current = null;
      if (!draft) return;
      const isShape = this.tool === "line" || this.tool === "rect";
      const stroke = { ...draft, points: isShape ? draft.points : simplifyPoints(draft.points) };
      this.redoStack = [];
      await this.sendStroke(stroke);
    },
    async sendStroke(stroke) {
      // Show it immediately; roll back if the server rejects it.
      this.addStroke({ ...stroke, userId: this.myId });
      this.redrawOverlay();
      try {
        await emitWithAck(this.socket, "wb:stroke", this.whiteboardId, stroke);
        this.myStrokeIds.push(stroke.id);
        return true;
      } catch (err) {
        this.strokes = this.strokes.filter((s) => s.id !== stroke.id);
        this.redrawBase();
        this.$toast.error(errorMessage(err));
        return false;
      }
    },
    async undo() {
      const strokeId = this.myStrokeIds[this.myStrokeIds.length - 1];
      if (!strokeId) return;
      const stroke = this.strokes.find((s) => s.id === strokeId);
      try {
        await emitWithAck(this.socket, "wb:undo", this.whiteboardId, strokeId);
        if (stroke) this.redoStack.push(stroke);
      } catch (err) {
        // Already gone (e.g. the board was cleared): forget it locally.
        this.myStrokeIds = this.myStrokeIds.filter((id) => id !== strokeId);
        if (err.message !== "not_found") this.$toast.error(errorMessage(err));
      }
    },
    async redo() {
      const stroke = this.redoStack.pop();
      if (!stroke) return;
      // Re-send as a new stroke so it can be undone again.
      await this.sendStroke({ id: newStrokeId(), color: stroke.color, width: stroke.width, points: stroke.points });
    },
    handleShortcut(event) {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        this.redo();
      }
    },
    download() {
      // Draw onto a white background so the PNG isn't transparent.
      const source = this.$refs.base;
      const out = document.createElement("canvas");
      out.width = source.width;
      out.height = source.height;
      const ctx = out.getContext("2d");
      ctx.fillStyle = BOARD_COLOR;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(source, 0, 0);
      const link = document.createElement("a");
      link.download = "whiteboard.png";
      link.href = out.toDataURL("image/png");
      link.click();
    },
    async clear() {
      this.confirmClear = false;
      try {
        await emitWithAck(this.socket, "wb:clear", this.whiteboardId);
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
  },
};
</script>

<style scoped>
.whiteboard {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.group {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-right: 10px;
  border-right: 1px solid #ccc;
}
.group:last-of-type {
  border-right: none;
}
.tool,
.width,
.action {
  height: 32px;
  min-width: 32px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  color: #333;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 8px;
  cursor: pointer;
}
.tool.active,
.width.active {
  border-color: #333;
  background: #e8e8e8;
}
.action:disabled {
  opacity: 0.45;
  cursor: default;
}
.action.danger {
  color: #b81010;
}
.swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #bbb;
  cursor: pointer;
}
.swatch.active {
  box-shadow: 0 0 0 2px #333;
}
.custom-color {
  position: relative;
  width: 28px;
  height: 28px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid #ccc;
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  cursor: pointer;
}
.custom-color i {
  color: #fff;
  font-size: 12px;
  text-shadow: 0 0 2px #000;
}
.custom-color input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.dot {
  display: inline-block;
  border-radius: 50%;
  background: #333;
}
.status {
  color: gray;
  font-size: 0.85em;
}
.surface {
  position: relative;
  width: 100%;
  /* Height follows width via CSS, so JS never resizes the observed element. */
  aspect-ratio: 16 / 10;
  background: #fff;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #ddd;
  overflow: hidden;
}
.layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.overlay {
  touch-action: none;
  cursor: crosshair;
}
.overlay.erasing {
  cursor: cell;
}
</style>
