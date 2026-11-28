import { describe, it, expect, vi } from "vitest";
import {
  MAX_STROKE_NUMBERS,
  normalizePoint,
  simplifyPoints,
  drawStroke,
} from "../src/workspaces/strokes.js";

describe("normalizePoint", () => {
  it("normalizePoint clamps (-5, 1200, 1000, 1000) to [0, 1]", () => {
    expect(normalizePoint(-5, 1200, 1000, 1000)).toEqual([0, 1]);
  });

  it("divides by the canvas size", () => {
    expect(normalizePoint(250, 50, 500, 200)).toEqual([0.5, 0.25]);
  });

  it("maps a zero-size canvas to the origin instead of NaN", () => {
    expect(normalizePoint(10, 10, 0, 0)).toEqual([0, 0]);
  });
});

describe("simplifyPoints", () => {
  it("simplifyPoints keeps endpoints and removes collinear midpoints", () => {
    const line = [0, 0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.5, 0.5];
    expect(simplifyPoints(line)).toEqual([0, 0, 0.5, 0.5]);
  });

  it("keeps a corner", () => {
    const corner = [0, 0, 0.25, 0, 0.5, 0, 0.5, 0.25, 0.5, 0.5];
    expect(simplifyPoints(corner)).toEqual([0, 0, 0.5, 0, 0.5, 0.5]);
  });

  it("returns short inputs unchanged", () => {
    expect(simplifyPoints([0.1, 0.2])).toEqual([0.1, 0.2]);
    expect(simplifyPoints([0.1, 0.2, 0.3, 0.4])).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("simplifyPoints output never exceeds 4000 numbers for a 20000-number input", () => {
    expect(MAX_STROKE_NUMBERS).toBe(4000);
    const points = [];
    for (let i = 0; i < 10000; i++) {
      const t = i / 9999;
      // A dense zig-zag: little is collinear, so tolerance must grow.
      points.push(t, 0.5 + (i % 2 ? 0.2 : -0.2) * Math.sin(t * 40));
    }
    const out = simplifyPoints(points);
    expect(out.length).toBeLessThanOrEqual(4000);
    expect(out.length % 2).toBe(0);
    expect(out.slice(0, 2)).toEqual(points.slice(0, 2));
    expect(out.slice(-2)).toEqual(points.slice(-2));
  });
});

describe("drawStroke", () => {
  function fakeCtx() {
    return {
      calls: [],
      beginPath: vi.fn(function () { this.calls.push(["begin"]); }),
      moveTo: vi.fn(function (x, y) { this.calls.push(["move", x, y]); }),
      lineTo: vi.fn(function (x, y) { this.calls.push(["line", x, y]); }),
      stroke: vi.fn(function () { this.calls.push(["stroke"]); }),
    };
  }

  it("draws scaled points with round caps/joins and width scaled by canvasWidth/1000", () => {
    const ctx = fakeCtx();
    drawStroke(ctx, { color: "#112233", width: 4, points: [0, 0, 0.5, 1] }, 500, 200);
    expect(ctx.lineCap).toBe("round");
    expect(ctx.lineJoin).toBe("round");
    expect(ctx.strokeStyle).toBe("#112233");
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.calls).toEqual([["begin"], ["move", 0, 0], ["line", 250, 200], ["stroke"]]);
  });

  it("draws a single point as a dot", () => {
    const ctx = fakeCtx();
    drawStroke(ctx, { color: "#000000", width: 10, points: [0.5, 0.5] }, 1000, 1000);
    expect(ctx.calls).toEqual([["begin"], ["move", 500, 500], ["line", 500, 500], ["stroke"]]);
  });
});
