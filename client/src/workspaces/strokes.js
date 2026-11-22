// Whiteboard geometry. Points are normalized to [0,1] and stored flat as
// [x0, y0, x1, y1, …] so drawings line up on any canvas size.

export const MAX_STROKE_NUMBERS = 4000;
// Stroke widths are expressed for a 1000px-wide board.
const REFERENCE_WIDTH = 1000;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Canvas pixel coordinates -> normalized [x, y], clamped to [0,1]. */
export function normalizePoint(x, y, width, height) {
  const nx = width > 0 ? x / width : 0;
  const ny = height > 0 ? y / height : 0;
  return [clamp01(nx), clamp01(ny)];
}

/** Squared distance from point p to segment a-b. */
function segmentDistanceSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** One Ramer–Douglas–Peucker pass (iterative) over a flat point array. */
function rdp(points, tolerance) {
  const n = points.length / 2;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tolSq = tolerance * tolerance;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = -1;
    let index = -1;
    const ax = points[2 * first];
    const ay = points[2 * first + 1];
    const bx = points[2 * last];
    const by = points[2 * last + 1];
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistanceSq(points[2 * i], points[2 * i + 1], ax, ay, bx, by);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolSq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(points[2 * i], points[2 * i + 1]);
  }
  return out;
}

/**
 * Simplify a flat stroke with RDP. Always keeps the first and last point;
 * doubles the tolerance until the result fits MAX_STROKE_NUMBERS.
 */
export function simplifyPoints(points, tolerance = 0.002) {
  let tol = tolerance;
  let out = rdp(points, tol);
  while (out.length > MAX_STROKE_NUMBERS) {
    tol *= 2;
    out = rdp(points, tol);
  }
  return out;
}

/** Draw one stroke on a 2D context sized width x height. */
export function drawStroke(ctx, stroke, width, height) {
  const pts = stroke.points || [];
  if (pts.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = (stroke.width * width) / REFERENCE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(pts[0] * width, pts[1] * height);
  if (pts.length === 2) {
    // A tap: a zero-length segment renders as a round dot.
    ctx.lineTo(pts[0] * width, pts[1] * height);
  }
  for (let i = 2; i < pts.length; i += 2) {
    ctx.lineTo(pts[i] * width, pts[i + 1] * height);
  }
  ctx.stroke();
}
