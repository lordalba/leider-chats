export const MAX_POINT_NUMBERS = 4000;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Converts canvas pixels to [0,1] coordinates, clamped. */
export function normalizePoint(x, y, width, height) {
  return [clamp01(width ? x / width : 0), clamp01(height ? y / height : 0)];
}

function perpendicularDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.hypot(dx, dy);
}

function rdp(points, tolerance) {
  const count = points.length / 2;
  if (count <= 2) return points.slice();
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const stack = [[0, count - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let maxIndex = -1;
    const ax = points[start * 2];
    const ay = points[start * 2 + 1];
    const bx = points[end * 2];
    const by = points[end * 2 + 1];
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i * 2], points[i * 2 + 1], ax, ay, bx, by);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxIndex !== -1 && maxDist > tolerance) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  const out = [];
  for (let i = 0; i < count; i++) {
    if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  }
  return out;
}

/**
 * Ramer–Douglas–Peucker on a flat [x0,y0,x1,y1,...] array. Always keeps the endpoints, and
 * doubles the tolerance until the result fits in MAX_POINT_NUMBERS numbers.
 */
export function simplifyPoints(points, tolerance = 0.002) {
  if (!points || points.length < 2) return [];
  const even = points.length % 2 === 0 ? points : points.slice(0, -1);
  let tol = tolerance;
  let result = rdp(even, tol);
  while (result.length > MAX_POINT_NUMBERS) {
    tol *= 2;
    result = rdp(even, tol);
  }
  // A single tap: duplicate the point so it is a valid (visible) stroke.
  if (result.length === 2) result = [result[0], result[1], result[0], result[1]];
  return result;
}

/** Draws a normalized stroke on a canvas of the given pixel size. Width scales with canvas width. */
export function drawStroke(ctx, stroke, width, height) {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.width * (width / 1000));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0] * width, pts[1] * height);
  if (pts.length === 2) {
    ctx.lineTo(pts[0] * width + 0.01, pts[1] * height);
  }
  for (let i = 2; i < pts.length; i += 2) {
    ctx.lineTo(pts[i] * width, pts[i + 1] * height);
  }
  ctx.stroke();
  ctx.restore();
}
