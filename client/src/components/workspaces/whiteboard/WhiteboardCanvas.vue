<template>
  <div class="whiteboard">
    <div class="wb-toolbar">
      <div class="wb-colors" role="group" aria-label="Colour">
        <button
          v-for="c in colors"
          :key="c"
          type="button"
          class="wb-swatch"
          :class="{ active: c === color }"
          :style="{ background: c }"
          :title="c"
          @click="color = c"
        ></button>
      </div>
      <div class="wb-widths" role="group" aria-label="Width">
        <button
          v-for="w in widths"
          :key="w"
          type="button"
          class="wb-width"
          :class="{ active: w === width }"
          :title="`Width ${w}`"
          @click="width = w"
        >
          <span :style="{ width: w + 'px', height: w + 'px' }"></span>
        </button>
      </div>
      <b-button
        size="sm"
        variant="outline-secondary"
        :disabled="!opened || !myLastStroke"
        @click="undo"
      >
        Undo my last stroke
      </b-button>
      <b-button
        v-if="canClear"
        size="sm"
        variant="outline-danger"
        :disabled="!opened"
        @click="clearBoard"
      >
        Clear board
      </b-button>
      <span v-if="status" class="wb-status">{{ status }}</span>
      <b-button v-if="openFailed" size="sm" variant="link" @click="open">Retry</b-button>
    </div>

    <div ref="board" class="wb-board">
      <canvas ref="base" class="wb-canvas"></canvas>
      <canvas
        ref="overlay"
        class="wb-canvas wb-overlay"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      ></canvas>
    </div>

  </div>
</template>

<script>
import { confirmDanger } from "@/workspaces/confirm";
import { emitWithAck } from "@/workspaces/socketCall";
import { itemErrorMessage } from "@/workspaces/items";
import {
  MAX_STROKE_NUMBERS,
  drawStroke,
  normalizePoint,
  simplifyPoints,
} from "@/workspaces/strokes";

const COLORS = ["#000000", "#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa"];
const WIDTHS = [2, 6, 14];
const DRAWING_THROTTLE_MS = 50;
// Remote in-progress strokes whose author vanished mid-stroke are dropped.
const LIVE_STROKE_TTL_MS = 5000;
// Fixed board shape so normalized points land in the same place on every screen.
const BOARD_ASPECT = 10 / 16;

function newStrokeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default {
  name: "WhiteboardCanvas",
  props: {
    whiteboardId: {
      type: String,
      required: true,
    },
    connectedUser: {
      type: Object,
      default: null,
    },
    // Board creator or chat admin (computed by the parent from the detail).
    canClear: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      colors: COLORS,
      widths: WIDTHS,
      color: COLORS[0],
      width: WIDTHS[1],
      status: "Loading…",
      // Bumped whenever this.strokes changes, so computed props re-evaluate
      // (the stroke list itself is kept non-reactive for drawing speed).
      strokesVersion: 0,
      learnedUserId: null,
      // True while this connection has the board open (joined its room).
      opened: false,
      // True once any snapshot has loaded; drawing offline is allowed after that.
      loaded: false,
      openFailed: false,
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    myId() {
      return (this.connectedUser && String(this.connectedUser._id)) || this.learnedUserId;
    },
    myLastStroke() {
      void this.strokesVersion;
      if (!this.myId || !this.strokes) return null;
      for (let i = this.strokes.length - 1; i >= 0; i--) {
        if (String(this.strokes[i].userId) === this.myId) return this.strokes[i];
      }
      return null;
    },
  },
  created() {
    // Non-reactive state.
    this.strokes = [];
    this.live = new Map(); // strokeId -> { stroke, at }
    this.current = null; // the stroke being drawn here
    this.lastDrawingSent = 0;
    this.drawingTimer = null;
    this.overlayFrame = null;
    this.openSeq = 0;
    // Pending stroke ids a clear wiped locally; their late acks must not re-add them.
    this.discarded = new Set();
  },
  mounted() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.$refs.board);
    this.resize();
    this.liveSweep = setInterval(() => this.sweepLive(), 1000);

    if (!this.socket) {
      this.status = itemErrorMessage("timeout", "whiteboard");
      return;
    }
    this.socket.on("wb:stroke", this.onRemoteStroke);
    this.socket.on("wb:stroke-removed", this.onStrokeRemoved);
    this.socket.on("wb:cleared", this.onCleared);
    this.socket.on("wb:drawing", this.onRemoteDrawing);
    this.socket.on("connect", this.open);
    this.socket.on("disconnect", this.onDisconnect);
    this.open();
  },
  beforeDestroy() {
    this.openSeq++;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    clearInterval(this.liveSweep);
    clearTimeout(this.drawingTimer);
    if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);
    if (this.socket) {
      this.socket.off("wb:stroke", this.onRemoteStroke);
      this.socket.off("wb:stroke-removed", this.onStrokeRemoved);
      this.socket.off("wb:cleared", this.onCleared);
      this.socket.off("wb:drawing", this.onRemoteDrawing);
      this.socket.off("connect", this.open);
      this.socket.off("disconnect", this.onDisconnect);
      if (this.socket.connected) {
        emitWithAck(this.socket, "wb:close", this.whiteboardId).catch(() => {});
      }
    }
  },
  methods: {
    // (Re)open: on mount and after every reconnect (rooms are per connection).
    async open() {
      const seq = ++this.openSeq;
      this.openFailed = false;
      try {
        const { strokes } = await emitWithAck(this.socket, "wb:open", this.whiteboardId);
        if (seq !== this.openSeq) return;
        const ids = new Set(strokes.map((s) => s.id));
        const unsent = this.strokes.filter((s) => s.pending && !ids.has(s.id));
        this.strokes = strokes.concat(unsent);
        this.strokesVersion++;
        this.opened = true;
        this.loaded = true;
        this.status = "";
        this.redrawBase();
        // Strokes drawn offline or whose ack was lost; the server dedups by id.
        unsent.forEach((stroke) => this.sendStroke(stroke));
      } catch (error) {
        if (seq !== this.openSeq) return;
        this.openFailed = true;
        this.onError(error);
      }
    },
    onDisconnect() {
      // Rooms are per connection: nothing may be sent until wb:open runs again,
      // or socket.io's offline buffer would deliver it before the re-join.
      this.opened = false;
      this.status = "Offline — reconnecting…";
    },
    onError(error) {
      const code = error && error.message;
      this.$toast.error(itemErrorMessage(code, "whiteboard"));
      if (code === "not_found" || code === "forbidden") this.$emit("closed");
      else this.status = itemErrorMessage(code, "whiteboard");
    },

    // ---- canvas sizing & drawing ----
    resize() {
      const board = this.$refs.board;
      if (!board) return;
      const cssWidth = board.clientWidth;
      const cssHeight = Math.round(cssWidth * BOARD_ASPECT);
      const dpr = window.devicePixelRatio || 1;
      for (const canvas of [this.$refs.base, this.$refs.overlay]) {
        canvas.style.height = cssHeight + "px";
        canvas.width = Math.max(1, Math.round(cssWidth * dpr));
        canvas.height = Math.max(1, Math.round(cssHeight * dpr));
        canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      board.style.height = cssHeight + "px";
      this.cssWidth = cssWidth;
      this.cssHeight = cssHeight;
      this.redrawBase();
      this.redrawOverlay();
    },
    redrawBase() {
      const canvas = this.$refs.base;
      if (!canvas || !this.cssWidth) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
      for (const stroke of this.strokes) drawStroke(ctx, stroke, this.cssWidth, this.cssHeight);
    },
    redrawOverlay() {
      this.overlayFrame = null;
      const canvas = this.$refs.overlay;
      if (!canvas || !this.cssWidth) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
      for (const { stroke } of this.live.values()) {
        drawStroke(ctx, stroke, this.cssWidth, this.cssHeight);
      }
      if (this.current) drawStroke(ctx, this.current, this.cssWidth, this.cssHeight);
    },
    scheduleOverlay() {
      if (!this.overlayFrame) this.overlayFrame = requestAnimationFrame(() => this.redrawOverlay());
    },

    // ---- local drawing ----
    pointFrom(event) {
      const rect = this.$refs.overlay.getBoundingClientRect();
      return normalizePoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    },
    onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (!this.socket || !this.loaded) return;
      event.preventDefault();
      this.$refs.overlay.setPointerCapture(event.pointerId);
      this.current = {
        id: newStrokeId(),
        color: this.color,
        width: this.width,
        points: this.pointFrom(event),
        pointerId: event.pointerId,
      };
      this.scheduleOverlay();
    },
    onPointerMove(event) {
      if (!this.current || event.pointerId !== this.current.pointerId) return;
      const [x, y] = this.pointFrom(event);
      const pts = this.current.points;
      if (pts[pts.length - 2] === x && pts[pts.length - 1] === y) return;
      pts.push(x, y);
      this.scheduleOverlay();
      this.queueDrawing();
    },
    queueDrawing() {
      if (this.drawingTimer) return;
      const wait = Math.max(0, DRAWING_THROTTLE_MS - (Date.now() - this.lastDrawingSent));
      this.drawingTimer = setTimeout(() => {
        this.drawingTimer = null;
        if (!this.current || !this.socket) return;
        this.lastDrawingSent = Date.now();
        const { id, color, width } = this.current;
        let points = this.current.points;
        if (points.length > MAX_STROKE_NUMBERS) points = simplifyPoints(points);
        this.socket.volatile.emit("wb:drawing", this.whiteboardId, {
          strokeId: id,
          color,
          width,
          points,
        });
      }, wait);
    },
    async onPointerUp(event) {
      if (!this.current || event.pointerId !== this.current.pointerId) return;
      const { id, color, width } = this.current;
      const points = simplifyPoints(this.current.points);
      this.current = null;
      clearTimeout(this.drawingTimer);
      this.drawingTimer = null;
      this.scheduleOverlay();

      const local = { id, color, width, points, userId: this.myId, pending: true };
      this.strokes.push(local);
      this.strokesVersion++;
      drawStroke(this.$refs.base.getContext("2d"), local, this.cssWidth, this.cssHeight);
      // Offline: stays pending, and the next wb:open sends it.
      if (this.opened) this.sendStroke(local);
    },
    async sendStroke(local) {
      const { id, color, width, points } = local;
      try {
        const stored = await emitWithAck(this.socket, "wb:stroke", this.whiteboardId, {
          id,
          color,
          width,
          points,
        });
        this.learnedUserId = this.learnedUserId || String(stored.userId);
        if (this.discarded.delete(id)) {
          // A clear wiped it while in flight; it may have been stored after
          // the clear, so let a fresh snapshot decide.
          if (this.opened) this.open();
          return;
        }
        this.replaceStroke(id, stored);
      } catch (error) {
        if (this.discarded.delete(id)) return;
        if (error.message === "timeout" || !this.opened) {
          // The server may have stored it (the ack was lost): keep it pending.
          // A reconnect reopens by itself; otherwise reopen now to settle it.
          if (this.opened) this.open();
          return;
        }
        this.removeStroke(id);
        this.$toast.error(
          error.message === "board_full"
            ? "This whiteboard is full (5000 strokes)"
            : itemErrorMessage(error.message, "whiteboard")
        );
      }
    },
    replaceStroke(id, stroke) {
      const index = this.strokes.findIndex((s) => s.id === id);
      if (index === -1) return;
      this.strokes.splice(index, 1, stroke);
      this.strokesVersion++;
    },
    removeStroke(id) {
      const before = this.strokes.length;
      this.strokes = this.strokes.filter((s) => s.id !== id);
      if (this.strokes.length === before) return;
      this.strokesVersion++;
      this.redrawBase();
    },
    async undo() {
      const stroke = this.myLastStroke;
      if (!this.opened || !stroke || stroke.pending) return;
      try {
        await emitWithAck(this.socket, "wb:undo", this.whiteboardId, stroke.id);
        this.removeStroke(stroke.id);
      } catch (error) {
        if (error.message === "not_found") this.removeStroke(stroke.id);
        else this.$toast.error(itemErrorMessage(error.message, "whiteboard"));
      }
    },
    async clearBoard() {
      if (!this.opened) return;
      const ok = await confirmDanger(this.$bvModal, {
        title: "Clear the whiteboard?",
        message: "Every stroke will be removed for everyone.",
        okTitle: "Clear board",
      });
      if (!ok || !this.opened) return;
      try {
        await emitWithAck(this.socket, "wb:clear", this.whiteboardId);
        this.onCleared({ whiteboardId: this.whiteboardId });
      } catch (error) {
        this.$toast.error(itemErrorMessage(error.message, "whiteboard"));
      }
    },

    // ---- remote events ----
    isMine(payload) {
      return payload && String(payload.whiteboardId) === this.whiteboardId;
    },
    onRemoteStroke(payload) {
      if (!this.isMine(payload) || !payload.stroke) return;
      const stroke = payload.stroke;
      if (this.live.delete(stroke.id)) this.scheduleOverlay();
      if (this.strokes.some((s) => s.id === stroke.id)) return;
      this.strokes.push(stroke);
      this.strokesVersion++;
      drawStroke(this.$refs.base.getContext("2d"), stroke, this.cssWidth, this.cssHeight);
    },
    onStrokeRemoved(payload) {
      if (!this.isMine(payload)) return;
      this.removeStroke(payload.strokeId);
    },
    onCleared(payload) {
      if (!this.isMine(payload)) return;
      // Pending strokes go too: one stored before the clear was deleted by it.
      // Their acks then trigger a fresh wb:open, which brings back any that
      // were stored after the clear.
      this.strokes.forEach((s) => {
        if (s.pending) this.discarded.add(s.id);
      });
      this.strokes = [];
      this.strokesVersion++;
      this.live.clear();
      this.redrawBase();
      this.scheduleOverlay();
    },
    onRemoteDrawing(payload) {
      if (!this.isMine(payload) || !Array.isArray(payload.points)) return;
      if (this.strokes.some((s) => s.id === payload.strokeId)) return;
      this.live.set(payload.strokeId, {
        stroke: { color: payload.color, width: payload.width, points: payload.points },
        at: Date.now(),
      });
      this.scheduleOverlay();
    },
    sweepLive() {
      const now = Date.now();
      let changed = false;
      for (const [id, entry] of this.live) {
        if (now - entry.at > LIVE_STROKE_TTL_MS) {
          this.live.delete(id);
          changed = true;
        }
      }
      if (changed) this.scheduleOverlay();
    },
  },
};
</script>

<style scoped>
.whiteboard {
  flex: 1;
  min-width: 0;
}
.wb-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.wb-colors,
.wb-widths {
  display: flex;
  gap: 4px;
}
.wb-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #ccc;
  cursor: pointer;
  padding: 0;
}
.wb-swatch.active {
  box-shadow: 0 0 0 2px #333;
}
.wb-width {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  padding: 0;
}
.wb-width.active {
  border-color: #333;
  background: #eee;
}
.wb-width span {
  display: block;
  border-radius: 50%;
  background: #333;
}
.wb-status {
  color: gray;
  font-size: 0.9em;
}
.wb-board {
  position: relative;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.wb-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
.wb-overlay {
  touch-action: none;
  cursor: crosshair;
}
</style>
