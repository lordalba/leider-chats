<template>
  <div class="whiteboard">
    <div class="toolbar">
      <button
        v-for="c in colors"
        :key="c"
        class="swatch"
        :class="{ active: color === c }"
        :style="{ backgroundColor: c }"
        :title="c"
        @click="color = c"
      ></button>
      <span class="divider"></span>
      <button
        v-for="w in widths"
        :key="w.value"
        class="width"
        :class="{ active: width === w.value }"
        :title="w.label"
        @click="width = w.value"
      >
        <span class="dot" :style="{ width: w.value + 4 + 'px', height: w.value + 4 + 'px' }"></span>
      </button>
      <span class="divider"></span>
      <button class="action" :disabled="myStrokeIds.length === 0" @click="undo">
        <i class="fa-solid fa-rotate-left"></i> Undo my last stroke
      </button>
      <button v-if="canClear" class="action danger" @click="confirmClear = true">
        <i class="fa-solid fa-eraser"></i> Clear board
      </button>
      <span v-if="!ready" class="status"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</span>
    </div>

    <div ref="surface" class="surface">
      <canvas ref="base" class="layer"></canvas>
      <canvas
        ref="overlay"
        class="layer overlay"
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
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import { drawStroke, normalizePoint, simplifyPoints, MAX_POINT_NUMBERS } from "@/workspaces/strokes";
import { emitWithAck, errorMessage } from "@/workspaces/socketCall";

const DRAWING_THROTTLE_MS = 50;
const ASPECT = 16 / 10;

const newStrokeId = () =>
  window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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
      colors: ["#222222", "#e6194b", "#4363d8", "#3cb44b", "#f58231", "#911eb4"],
      widths: [
        { value: 2, label: "Thin" },
        { value: 6, label: "Medium" },
        { value: 14, label: "Thick" },
      ],
      color: "#222222",
      width: 6,
      ready: false,
      confirmClear: false,
      myStrokeIds: [],
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
  },
  mounted() {
    // Non-reactive drawing state.
    this.strokes = [];
    this.remoteDrawing = new Map(); // strokeId -> in-progress stroke from someone else
    this.current = null;
    this.lastDrawingEmit = 0;
    this.size = { width: 0, height: 0 };

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
        this.remoteDrawing.clear();
        this.redrawBase();
        this.redrawOverlay();
      },
      connect: () => this.open(),
    };
    Object.entries(this.handlers).forEach(([event, fn]) => this.socket.on(event, fn));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.$refs.surface);
    this.resize();
    this.open();
  },
  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
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
    resize() {
      const surface = this.$refs.surface;
      if (!surface) return;
      const width = surface.clientWidth;
      const height = Math.round(width / ASPECT);
      const dpr = window.devicePixelRatio || 1;
      this.size = { width, height };
      surface.style.height = height + "px";
      [this.$refs.base, this.$refs.overlay].forEach((canvas) => {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
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
      const [x, y] = this.pointFrom(event);
      this.current = { id: newStrokeId(), color: this.color, width: this.width, points: [x, y] };
      this.redrawOverlay();
    },
    onPointerMove(event) {
      if (!this.current) return;
      const [x, y] = this.pointFrom(event);
      // Keep the raw stroke bounded; it is simplified on pointer-up.
      if (this.current.points.length < MAX_POINT_NUMBERS * 5) this.current.points.push(x, y);
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
      const stroke = { ...draft, points: simplifyPoints(draft.points) };
      // Show it immediately; roll back if the server rejects it.
      this.addStroke({ ...stroke, userId: this.myId });
      this.redrawOverlay();
      try {
        await emitWithAck(this.socket, "wb:stroke", this.whiteboardId, stroke);
        this.myStrokeIds.push(stroke.id);
      } catch (err) {
        this.strokes = this.strokes.filter((s) => s.id !== stroke.id);
        this.redrawBase();
        this.$toast.error(errorMessage(err));
      }
    },
    async undo() {
      const strokeId = this.myStrokeIds[this.myStrokeIds.length - 1];
      if (!strokeId) return;
      try {
        await emitWithAck(this.socket, "wb:undo", this.whiteboardId, strokeId);
      } catch (err) {
        // Already gone (e.g. the board was cleared): forget it locally.
        this.myStrokeIds = this.myStrokeIds.filter((id) => id !== strokeId);
        if (err.message !== "not_found") this.$toast.error(errorMessage(err));
      }
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
  gap: 6px;
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
.width {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.width.active {
  border-color: #333;
  background: #eee;
}
.dot {
  display: inline-block;
  border-radius: 50%;
  background: #333;
}
.divider {
  width: 1px;
  height: 22px;
  background: #ccc;
  margin: 0 6px;
}
.action {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
}
.action:disabled {
  opacity: 0.5;
}
.action.danger {
  color: #b81010;
}
.status {
  color: gray;
  font-size: 0.85em;
}
.surface {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #ddd;
  overflow: hidden;
}
.layer {
  position: absolute;
  top: 0;
  left: 0;
}
.overlay {
  touch-action: none;
  cursor: crosshair;
}
</style>
