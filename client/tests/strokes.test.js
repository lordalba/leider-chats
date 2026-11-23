import { describe, expect, it } from "vitest";
import { MAX_POINT_NUMBERS, normalizePoint, simplifyPoints } from "../src/workspaces/strokes.js";

describe("strokes", () => {
  it("normalizePoint clamps (-5, 1200, 1000, 1000) to [0, 1]", () => {
    expect(normalizePoint(-5, 1200, 1000, 1000)).toEqual([0, 1]);
    expect(normalizePoint(250, 500, 1000, 1000)).toEqual([0.25, 0.5]);
  });

  it("simplifyPoints keeps endpoints and removes collinear midpoints", () => {
    const line = [0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1];
    expect(simplifyPoints(line)).toEqual([0, 0, 1, 1]);

    const corner = [0, 0, 0.5, 0, 1, 0, 1, 0.5, 1, 1];
    expect(simplifyPoints(corner)).toEqual([0, 0, 1, 0, 1, 1]);
  });

  it("simplifyPoints output never exceeds 4000 numbers for a 20000-number input", () => {
    const pts = [];
    for (let i = 0; i < 10000; i++) {
      const t = i / 9999;
      pts.push(t, 0.5 + 0.4 * Math.sin(t * 200) * (i % 2 ? 1 : -1));
    }
    expect(pts).toHaveLength(20000);
    const out = simplifyPoints(pts.map((v) => Math.min(1, Math.max(0, v))));
    expect(out.length).toBeLessThanOrEqual(MAX_POINT_NUMBERS);
    expect(out.length % 2).toBe(0);
    expect(out.slice(0, 2)).toEqual([pts[0], Math.min(1, Math.max(0, pts[1]))]);
  });

  it("a single tap becomes a valid two-point stroke", () => {
    expect(simplifyPoints([0.3, 0.4])).toEqual([0.3, 0.4, 0.3, 0.4]);
  });
});
