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
import { parseVector2 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import type { Node2DProperties, Vector2 } from './types';

const TRANSFORM2D_RE =
  /^Transform2D\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)$/;

export function isNode2D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Node2D';
}

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

  const matrix = properties.transform ? decomposeTransform2D(properties.transform, name) : null;
  if (matrix) {
    ({ position, rotation, scale } = matrix);
  } else {
    if (properties.position) position = parseVector2Or(properties.position, position, name);
    if (properties.scale) scale = parseVector2Or(properties.scale, scale, name);
    if (properties.rotation !== undefined) rotation = floatOr(properties.rotation, 0);
    else if (properties.rotation_degrees !== undefined)
      rotation = (floatOr(properties.rotation_degrees, 0) * Math.PI) / 180;
  }

  return {
    name,
    parent: heading.attributes.parent,
    instance: heading.attributes.instance,
    index: heading.attributes.index ? parseInt(heading.attributes.index, 10) : undefined,
    visible,
    position,
    rotation,
    scale,
    skew: floatOr(properties.skew, 0),
    z_index: intOr(properties.z_index, 0),
    z_as_relative: properties.z_as_relative === undefined ? true : properties.z_as_relative !== 'false',
  };
}

/** Decompose `Transform2D(xx, xy, yx, yy, ox, oy)` into position/rotation/scale. */
export function decomposeTransform2D(
  value: string,
  nodeName = ''
): { position: Vector2; rotation: number; scale: Vector2 } | null {
  const m = TRANSFORM2D_RE.exec(value.trim());
  if (!m) {
    warn(`Node2D${nodeName ? ` "${nodeName}"` : ''}: invalid Transform2D "${value}"`);
    return null;
  }
  const xx = parseFloat(m[1]!);
  const xy = parseFloat(m[2]!);
  const yx = parseFloat(m[3]!);
  const yy = parseFloat(m[4]!);
  const ox = parseFloat(m[5]!);
  const oy = parseFloat(m[6]!);

  const rotation = Math.atan2(xy, xx);
  const det = xx * yy - xy * yx;
  const scaleX = Math.hypot(xx, xy);
  // Negative determinant ⇒ a flip; Godot folds it into scale.y's sign.
  const scaleY = Math.hypot(yx, yy) * (det < 0 ? -1 : 1);

  return { position: { x: ox, y: oy }, rotation, scale: { x: scaleX, y: scaleY } };
}

function floatOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function intOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseVector2Or(value: string, fallback: Vector2, nodeName: string): Vector2 {
  try {
    return parseVector2(value);
  } catch (error) {
    warn(
      `Node2D${nodeName ? ` "${nodeName}"` : ''}: invalid Vector2 "${value}": ${error instanceof Error ? error.message : String(error)}`
    );
    return fallback;
  }
}
