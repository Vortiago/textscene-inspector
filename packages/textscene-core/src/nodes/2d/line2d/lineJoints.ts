/**
 * Joint wedges for a Line2D's poly-stroke, which fill the gap outside every
 * interior corner: Godot has no "no joint" mode (`joint_mode` defaults to
 * `LINE_JOINT_SHARP`). In three-space, as flat self-contained triangles, since the
 * stroke is not indexed across joints.
 */

export const LINE_JOINT_SHARP = 0;
export const LINE_JOINT_BEVEL = 1;
export const LINE_JOINT_ROUND = 2;

interface Point {
  x: number;
  y: number;
}

export interface JointOptions {
  jointMode: number;
  /** Miter length limit, in half-widths. Godot default 2.0. */
  sharpLimit: number;
  /** Segments per round joint. Godot default 8. */
  roundPrecision: number;
}

/**
 * Triangles filling the outer gap at `corner`, between the segment arriving
 * from `prev` and the one leaving to `next`. Returns a flat `[x, y, z, …]`
 * array, empty when the corner is straight (or degenerate) and needs no wedge.
 */
export function jointWedge(
  prev: Point,
  corner: Point,
  next: Point,
  halfWidth: number,
  options: JointOptions
): number[] {
  const inDir = normalize(corner.x - prev.x, corner.y - prev.y);
  const outDir = normalize(next.x - corner.x, next.y - corner.y);
  if (!inDir || !outDir) return [];

  // Cross product sign says which side the turn opens up on. Zero means the
  // corner is straight and the two quads already meet flush.
  const cross = inDir.x * outDir.y - inDir.y * outDir.x;
  if (Math.abs(cross) < 1e-9) return [];

  // Outward normal is the one pointing away from the turn.
  const side = cross > 0 ? -1 : 1;
  const nIn = { x: -inDir.y * side, y: inDir.x * side };
  const nOut = { x: -outDir.y * side, y: outDir.x * side };

  const a = { x: corner.x + nIn.x * halfWidth, y: corner.y + nIn.y * halfWidth };
  const b = { x: corner.x + nOut.x * halfWidth, y: corner.y + nOut.y * halfWidth };

  if (options.jointMode === LINE_JOINT_ROUND) {
    return roundFan(corner, a, b, Math.max(1, Math.round(options.roundPrecision)));
  }

  if (options.jointMode === LINE_JOINT_SHARP) {
    const tip = miterTip(corner, nIn, nOut, halfWidth);
    // SHARP (0): miter to where the outer edges meet, and bevel when the tip runs past
    // `sharp_limit x half_width` (`line_builder.cpp`: `corner_pos_out.distance_squared_to(pos1)
    // / (hw_sq * width_factor_sq) > sharp_limit_sq`). BEVEL (1) is one triangle across
    // the gap, and ROUND (2) a fan of `round_precision` segments.
    if (tip && distance(tip, corner) <= options.sharpLimit * halfWidth) {
      return [...triangle(corner, a, tip), ...triangle(corner, tip, b)];
    }
  }

  return triangle(corner, a, b);
}

function miterTip(
  corner: Point,
  nIn: Point,
  nOut: Point,
  halfWidth: number
): Point | null {
  // The miter direction bisects the two outer normals.
  const bx = nIn.x + nOut.x;
  const by = nIn.y + nOut.y;
  const bisector = normalize(bx, by);
  if (!bisector) return null;
  // Scale so the tip lands on both offset edges: 1 / cos(half the turn).
  const cos = bisector.x * nIn.x + bisector.y * nIn.y;
  if (cos <= 1e-6) return null;
  const length = halfWidth / cos;
  return { x: corner.x + bisector.x * length, y: corner.y + bisector.y * length };
}

function roundFan(corner: Point, a: Point, b: Point, segments: number): number[] {
  const start = Math.atan2(a.y - corner.y, a.x - corner.x);
  const end = Math.atan2(b.y - corner.y, b.x - corner.x);
  // Sweep the short way around: the gap is always less than half a turn.
  let sweep = end - start;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;

  const radius = distance(a, corner);
  const out: number[] = [];
  let previous = a;
  for (let i = 1; i <= segments; i++) {
    const angle = start + (sweep * i) / segments;
    const point = {
      x: corner.x + Math.cos(angle) * radius,
      y: corner.y + Math.sin(angle) * radius,
    };
    out.push(...triangle(corner, previous, point));
    previous = point;
  }
  return out;
}

function triangle(p0: Point, p1: Point, p2: Point): number[] {
  return [p0.x, p0.y, 0, p1.x, p1.y, 0, p2.x, p2.y, 0];
}

function normalize(x: number, y: number): Point | null {
  const length = Math.hypot(x, y);
  return length < 1e-9 ? null : { x: x / length, y: y / length };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
