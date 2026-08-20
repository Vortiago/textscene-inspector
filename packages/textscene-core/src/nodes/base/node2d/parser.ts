/**
 * Node2D parser — parses the 2D transform + draw-order surface.
 *
 * Godot serialises a Node2D's placement either as discrete
 * `position`/`rotation`/`scale`/`skew` properties or as a single
 * `transform = Transform2D(xx, xy, yx, yy, ox, oy)` (x-axis, y-axis, origin).
 * When the matrix form is present it wins and is decomposed; otherwise the
 * discrete props are read. Angles are radians (`rotation_degrees` is converted).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseColor } from '../../../utils/colorParser';
import { floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { slotTupleRegex, matchedFloat, allFinite } from '../../../godot/number.js';
import { warn } from '../../../logger';
import type { Node2DProperties, Vector2 } from './types';

const TRANSFORM2D_RE = slotTupleRegex('Transform2D', 6);

export function parseNode2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Node2DProperties {
  const name = heading.attributes.name || '';
  const visible = properties.visible === undefined ? undefined : properties.visible !== 'false';

  // Defaults match Godot.
  let position: Vector2 = { x: 0, y: 0 };
  let rotation = 0;
  let scale: Vector2 = { x: 1, y: 1 };
  // Matrix form wins and carries its own (decomposed) skew; the discrete `skew`
  // property only applies in the discrete-props path. Both paths assign, so
  // there is no default to state here.
  let skew: number;

  const matrix = properties.transform ? decomposeTransform2D(properties.transform, name) : null;
  if (matrix) {
    ({ position, rotation, scale } = matrix);
    skew = matrix.skew;
  } else {
    if (properties.position) position = vec2Or(properties.position, position, name || 'Node2D');
    if (properties.scale) scale = vec2Or(properties.scale, scale, name || 'Node2D');
    if (properties.rotation !== undefined) rotation = floatOr(properties.rotation, 0);
    else if (properties.rotation_degrees !== undefined)
      rotation = (floatOr(properties.rotation_degrees, 0) * Math.PI) / 180;
    skew = floatOr(properties.skew, 0);
  }

  return {
    name,
    parent: heading.attributes.parent,
    instance: heading.attributes.instance,
    index: heading.attributes.index ? Number(heading.attributes.index) : undefined,
    visible,
    position,
    rotation,
    scale,
    skew,
    z_index: intOr(properties.z_index, 0),
    z_as_relative: properties.z_as_relative === undefined ? true : properties.z_as_relative !== 'false',
    show_behind_parent: properties.show_behind_parent === 'true',
    modulate: properties.modulate ? parseColor(properties.modulate) : { r: 1, g: 1, b: 1, a: 1 },
    self_modulate: properties.self_modulate
      ? parseColor(properties.self_modulate)
      : { r: 1, g: 1, b: 1, a: 1 },
    light_mask: intOr(properties.light_mask, 1, `${name || 'Node2D'}.light_mask`),
    y_sort_enabled: properties.y_sort_enabled === 'true',
    y_sort_origin: properties.y_sort_origin !== undefined
      ? floatOr(properties.y_sort_origin, 0)
      : 0,
    ...(properties.material !== undefined ? { material: properties.material } : {}),
    use_parent_material: properties.use_parent_material === 'true',
  };
}

/** Decompose `Transform2D(xx, xy, yx, yy, ox, oy)` into position/rotation/scale/skew. */
export function decomposeTransform2D(
  value: string,
  nodeName = ''
): { position: Vector2; rotation: number; scale: Vector2; skew: number } | null {
  const m = TRANSFORM2D_RE.exec(value.trim());
  if (!m) {
    warn(`Node2D${nodeName ? ` "${nodeName}"` : ''}: invalid Transform2D "${value}"`);
    return null;
  }
  const [xx, xy, yx, yy, ox, oy] = m.slice(1, 7).map((v) => matchedFloat(v)) as [
    number, number, number, number, number, number,
  ];
  // An overflowing exponent is inside the finite grammar; the decomposition
  // below turns it into a NaN skew and a canvas transform nothing draws under.
  if (!allFinite([xx, xy, yx, yy, ox, oy])) {
    warn(`Node2D${nodeName ? ` "${nodeName}"` : ''}: non-finite Transform2D "${value}"`);
    return null;
  }

  const rotation = Math.atan2(xy, xx);
  const det = xx * yy - xy * yx;
  const lenX = Math.hypot(xx, xy);
  const lenY = Math.hypot(yx, yy);
  const scaleX = lenX;
  // Negative determinant ⇒ a flip; Godot folds it into scale.y's sign.
  const sign = det < 0 ? -1 : 1;
  const scaleY = lenY * sign;
  // Godot Transform2D::get_skew(): the signed deviation of the (flip-corrected)
  // Y axis from perpendicular to X. acos(X̂ · sign·Ŷ) − π/2 (0 when the axes are
  // orthogonal). Guard the degenerate zero-length case → 0.
  let skew = 0;
  if (lenX > 0 && lenY > 0) {
    const dot = Math.max(-1, Math.min(1, (xx * sign * yx + xy * sign * yy) / (lenX * lenY)));
    skew = Math.acos(dot) - Math.PI / 2;
  }

  return { position: { x: ox, y: oy }, rotation, scale: { x: scaleX, y: scaleY }, skew };
}
