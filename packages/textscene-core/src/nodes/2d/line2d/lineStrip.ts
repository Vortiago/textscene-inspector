/**
 * The triangle strip Godot's `LineBuilder` grows (`scene/2d/line_builder.cpp:434-598`): a pair of
 * vertices on each side of the line, joined to the next pair by a quad, plus the triangles of a
 * bevel, a round joint and a round cap. Every number is a `float`, as Godot's are.
 */

import type { Rgba } from '../../../godot/math/math';
import { storedReal as f } from '../../../godot/math/real';
import {
  vector2Add,
  vector2Length,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../../godot/math/vector';

/** The side of the line a joint opens on, which is also the index of that side's last vertex. */
export const UP = 0;
export const DOWN = 1;
export type Orientation = typeof UP | typeof DOWN;

const opposite = (orientation: Orientation): Orientation => (orientation === UP ? DOWN : UP);

/** `Math::PI` as the `float` every angle of `LineBuilder` holds. */
const PI = f(Math.PI);

/**
 * The strip so far. `colors` holds one entry per vertex with a gradient and is null without one.
 * Written only by the functions of this module, and read once by `buildLineStroke`.
 */
export interface Strip {
  readonly vertices: Vector2[];
  readonly colors: Rgba[] | null;
  readonly indices: number[];
  /** The vertex each side of the strip last reached. Both start at 0, as `_last_index` does. */
  readonly lastIndex: [number, number];
}

export function createStrip(hasColors: boolean): Strip {
  return { vertices: [], colors: hasColors ? [] : null, indices: [], lastIndex: [0, 0] };
}

/** Starts a strip at the pair `up` and `down`, with no quad to the vertices before. */
export function stripBegin(strip: Strip, up: Vector2, down: Vector2, color: Rgba | null): void {
  const first = strip.vertices.length;
  pushVertex(strip, up, color);
  pushVertex(strip, down, color);
  strip.lastIndex[UP] = first;
  strip.lastIndex[DOWN] = first + 1;
}

/** Joins the last pair to a new pair `up` and `down` with one quad. */
export function stripAddQuad(strip: Strip, up: Vector2, down: Vector2, color: Rgba | null): void {
  const first = strip.vertices.length;
  pushVertex(strip, up, color);
  pushVertex(strip, down, color);
  const { lastIndex } = strip;
  strip.indices.push(lastIndex[UP], first + 1, lastIndex[DOWN], lastIndex[UP], first, first + 1);
  lastIndex[UP] = first;
  lastIndex[DOWN] = first + 1;
}

/**
 * Adds the triangle of the last vertex of each side and the new vertex `point`, which replaces the
 * last vertex of the side opposite `orientation`. A bevel is one such triangle.
 */
export function stripAddTri(strip: Strip, point: Vector2, orientation: Orientation): void {
  const first = strip.vertices.length;
  const { colors, lastIndex } = strip;
  pushVertex(strip, point, colors && colors[colors.length - 1]!);
  const other = opposite(orientation);
  strip.indices.push(lastIndex[other], first, lastIndex[orientation]);
  lastIndex[other] = first;
}

/** Extrudes an arc of `angleDelta` around `center` from the last vertex of the side opposite `orientation`. */
export function stripAddArc(
  strip: Strip,
  center: Vector2,
  angleDelta: number,
  orientation: Orientation,
  roundPrecision: number
): void {
  const begin = vector2Sub(strip.vertices[strip.lastIndex[opposite(orientation)]]!, center);
  const radius = vector2Length(begin);
  const steps = arcStepCount(angleDelta, roundPrecision);
  const step = signedStep(angleDelta, roundPrecision);

  let angle = angleOf(begin);
  const endAngle = f(angle + angleDelta);
  for (let i = 0; i < steps; i++, angle = f(angle + step)) {
    stripAddTri(strip, pointOnArc(center, angle, radius), orientation);
  }
  stripAddTri(strip, pointOnArc(center, endAngle, radius), orientation);
}

/**
 * Adds a fan of triangles around `center` that shares no vertex with the strip: a round cap, from
 * `begin` through `angleDelta`.
 */
export function newArc(
  strip: Strip,
  center: Vector2,
  begin: Vector2,
  angleDelta: number,
  roundPrecision: number,
  color: Rgba | null
): void {
  const radius = vector2Length(begin);
  const steps = arcStepCount(angleDelta, roundPrecision);
  const step = signedStep(angleDelta, roundPrecision);

  const hub = strip.vertices.length;
  pushVertex(strip, center, color);
  let angle = angleOf(begin);
  const endAngle = f(angle + angleDelta);
  for (let i = 0; i < steps; i++, angle = f(angle + step)) {
    pushVertex(strip, pointOnArc(center, angle, radius), color);
  }
  pushVertex(strip, pointOnArc(center, endAngle, radius), color);

  for (let i = 0; i < steps; i++) strip.indices.push(hub, hub + 1 + i, hub + 2 + i);
}

function pushVertex(strip: Strip, point: Vector2, color: Rgba | null): void {
  strip.vertices.push(point);
  if (strip.colors && color) strip.colors.push(color);
}

/** The steps of one arc, as `abs(angle_delta) / angle_step` rounds up in the loop condition. */
function arcStepCount(angleDelta: number, roundPrecision: number): number {
  return f(Math.abs(angleDelta) / f(PI / roundPrecision));
}

function signedStep(angleDelta: number, roundPrecision: number): number {
  const step = f(PI / roundPrecision);
  return angleDelta < 0 ? -step : step;
}

/** `Vector2(1, 0).angle_to(vector)`: the angle of `vector` from the X axis. */
function angleOf({ x, y }: Vector2): number {
  return f(Math.atan2(y, x));
}

function pointOnArc(center: Vector2, angle: number, radius: number): Vector2 {
  return vector2Add(center, vector2Scaled({ x: f(Math.cos(angle)), y: f(Math.sin(angle)) }, radius));
}
