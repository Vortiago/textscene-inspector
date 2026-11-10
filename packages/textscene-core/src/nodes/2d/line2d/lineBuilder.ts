/**
 * Builds the triangles of a Line2D stroke as Godot's `LineBuilder::build` does
 * (`scene/2d/line_builder.cpp:45-432`): one strip along the line, bevel and round joints and
 * round caps as extra triangles, and no area drawn twice. A pure function of numbers, in Godot's
 * space with Y down. With a `texture_mode` it also gives the UVs, in the texture's own space (v 0 on top).
 */

import { isZeroApprox, type Rgba } from '../../../godot/math/math';
import { storedReal as f } from '../../../godot/math/real';
import {
  normalizedVector2,
  vector2Add,
  vector2Cross,
  vector2Dot,
  vector2DistanceTo,
  vector2Lerp,
  vector2Orthogonal,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../../godot/math/vector';
import type { Line2DProperties } from './types';
import { LineCapMode, LineJointMode, LineTextureMode } from '../../../godot/scene/line2d.js';
import { resolveJoint, type Joint } from './lineJoint';
import {
  createStrip,
  newArc,
  stripAddArc,
  stripAddQuad,
  stripAddTri,
  stripBegin,
  UP,
  type Orientation,
  type Strip,
} from './lineStrip';

/** The colours a Line2D's `gradient` gives the stroke: the first stop, the last and the one between. */
export interface StrokeGradient {
  first: Rgba;
  last: Rgba;
  /** `Gradient.get_color_at_offset` for an offset along the line from 0 to 1. */
  colorAt: (offset: number) => Rgba;
}

export type LineStrokeOptions = Pick<
  Line2DProperties,
  | 'points'
  | 'width'
  | 'closed'
  | 'jointMode'
  | 'sharpLimit'
  | 'roundPrecision'
  | 'beginCapMode'
  | 'endCapMode'
  | 'textureMode'
> & {
  /** Null draws one colour, which the caller owns: `default_color` is not part of the stroke. */
  gradient: StrokeGradient | null;
  /** `Curve.sample_baked` of `width_curve` for an offset from 0 to 1, or null for a constant width. */
  widthFactorAt: ((offset: number) => number) | null;
  /** The texture's width over its height (`Size2::aspect`), and 1 without a texture (`line_builder.h:51`). */
  tileAspect: number;
};

export interface LineStroke {
  /** Flat `[x, y, …]`. */
  vertices: Float32Array;
  /** Flat `[r, g, b, a, …]`, one colour per vertex, or null without a gradient. */
  colors: Float32Array | null;
  /** Flat `[u, v, …]`, one per vertex, or null for `texture_mode` NONE. */
  uvs: Float32Array | null;
  indices: number[];
}

/**
 * The stroke of the line, or null where Godot draws nothing: fewer than 2 points, a width of 0
 * (`line_2d.cpp:275`), a texture aspect of 0 or less (`line_builder.cpp:55`), a zero total length
 * where the distance is read (`line_builder.cpp:115`).
 */
export function buildLineStroke(options: LineStrokeOptions): LineStroke | null {
  const points = toPoints(options.points);
  if (points.length < 2 || options.width === 0 || options.tileAspect <= 0) return null;

  const walk = new StrokeWalk(options, points);
  if (walk.hasZeroLength) return null;
  walk.run();
  return walk.finish();
}

function toPoints(flat: Float32Array): Vector2[] {
  return Array.from({ length: Math.floor(flat.length / 2) }, (_, i) => ({
    x: flat[i * 2]!,
    y: flat[i * 2 + 1]!,
  }));
}

/**
 * The pair that ends the first segment of a closed line, which its last segment closes on. Null
 * where the width factor there is 0: Godot's `1 / 0` weight makes the pair NaN (`line_builder.cpp:316`),
 * and measured on 4.6.3 its closing quad draws nothing.
 */
interface FirstJoint {
  pair: { up: Vector2; down: Vector2 } | null;
  isSharp: boolean;
}

/** One pass of `LineBuilder::build` along a line, with the state it carries from point to point. */
class StrokeWalk {
  readonly hasZeroLength: boolean;
  private readonly strip: Strip;
  private readonly halfWidth: number;
  private readonly wrapsAround: boolean;
  private readonly totalDistance: number;

  /** The point behind the walk, the quarter turn of its segment and the pair that starts that segment. */
  private pos0: Vector2;
  private normal0: Vector2;
  private forward0: Vector2;
  private up0: Vector2;
  private down0: Vector2;
  private color0: Rgba | null;
  private distance = 0;
  private widthFactor = 1;
  /** The `u` of the pair the walk last passed, which the next pair of a texture mode overwrites. */
  private uvx = 0;

  constructor(
    private readonly options: LineStrokeOptions,
    private readonly points: Vector2[]
  ) {
    this.strip = createStrip(options.gradient !== null, options.textureMode !== LineTextureMode.NONE);
    this.halfWidth = f(options.width / 2);
    this.wrapsAround = options.closed && points.length > 2;
    this.widthFactor = options.widthFactorAt ? options.widthFactorAt(0) : 1;
    this.totalDistance = this.measureTotalDistance();
    this.hasZeroLength = this.needsDistance && isZeroApprox(this.totalDistance);

    this.pos0 = points[0]!;
    this.forward0 = normalizedVector2(vector2Sub(points[1]!, this.pos0));
    this.normal0 = vector2Orthogonal(this.forward0);
    this.color0 = options.gradient?.first ?? null;
    const reach = vector2Scaled(this.normal0, this.modifiedHalfWidth);
    this.up0 = vector2Add(this.pos0, reach);
    this.down0 = vector2Sub(this.pos0, reach);
  }

  run(): void {
    if (!this.wrapsAround) this.addBeginCap();
    this.addJoints();
    if (!this.wrapsAround) this.addEndSegment();
  }

  finish(): LineStroke | null {
    const { vertices, colors, uvs, indices } = this.strip;
    if (indices.length === 0) return null;
    return {
      vertices: Float32Array.from(vertices.flatMap(({ x, y }) => [x, y])),
      colors: colors && Float32Array.from(colors.flatMap(({ r, g, b, a }) => [r, g, b, a])),
      uvs: uvs && Float32Array.from(uvs.flatMap(({ x, y }) => [x, y])),
      indices,
    };
  }

  /** The distance along the line is read by a gradient, a width curve and the TILE and STRETCH UVs only. */
  private get needsDistance(): boolean {
    const { gradient, widthFactorAt, textureMode } = this.options;
    return gradient !== null || widthFactorAt !== null || textureMode !== LineTextureMode.NONE;
  }

  private get modifiedHalfWidth(): number {
    return f(this.halfWidth * this.widthFactor);
  }

  /** `line_builder.cpp:92-113`: the length of the line, with a cap's half-width on each open end. */
  private measureTotalDistance(): number {
    if (!this.needsDistance) return 0;
    const { points, options } = this;
    let total = 0;
    for (let i = 1; i < points.length; i++) total = f(total + vector2DistanceTo(points[i]!, points[i - 1]!));
    if (this.wrapsAround) return f(total + vector2DistanceTo(points[points.length - 1]!, points[0]!));

    if (options.beginCapMode !== LineCapMode.NONE) total = f(total + this.modifiedHalfWidth);
    if (options.endCapMode !== LineCapMode.NONE) {
      total = f(
        total + (options.widthFactorAt ? f(this.halfWidth * options.widthFactorAt(1)) : this.halfWidth)
      );
    }
    return total;
  }

  private addBeginCap(): void {
    const { beginCapMode, roundPrecision } = this.options;
    const reach = this.modifiedHalfWidth;
    let uvx = 0;
    if (beginCapMode === LineCapMode.BOX) {
      const back = vector2Scaled(this.forward0, reach);
      this.up0 = vector2Sub(this.up0, back);
      this.down0 = vector2Sub(this.down0, back);
      this.distance = reach;
    } else if (beginCapMode === LineCapMode.ROUND) {
      uvx = this.beginCapUvx();
      const uvRect = { x: 0, y: 0, width: f(uvx * 2), height: 1 };
      const begin = vector2Sub(this.up0, this.pos0);
      newArc(this.strip, this.pos0, begin, -Math.PI, roundPrecision, this.color0, uvRect);
      this.distance = reach;
    }
    stripBegin(this.strip, this.up0, this.down0, this.color0, uvx);
  }

  /** The `u` of the distance walked: tiles of `width * tile_aspect` for TILE, the share of the line for STRETCH. */
  private uvxAtDistance(): number {
    const { textureMode, tileAspect, width } = this.options;
    if (textureMode === LineTextureMode.TILE) return f(this.distance / f(f(width) * tileAspect));
    if (textureMode === LineTextureMode.STRETCH) return f(this.distance / this.totalDistance);
    return 0;
  }

  /**
   * The `u` where a round begin cap ends and the strip starts (`line_builder.cpp:142-146`). TILE is
   * half the cap's square, so the square is as wide as the line is across. STRETCH is the whole of
   * that width, and the rectangle doubles it: Godot's own choice, which the port keeps.
   */
  private beginCapUvx(): number {
    const { textureMode, tileAspect } = this.options;
    if (textureMode === LineTextureMode.TILE) return f(f(this.widthFactor * 0.5) / tileAspect);
    if (textureMode === LineTextureMode.STRETCH) return this.stretchedLineWidth();
    return 0;
  }

  /** The `u` span of a round end cap's rectangle (`line_builder.cpp:372-376`). */
  private endCapUvWidth(): number {
    const { textureMode, tileAspect } = this.options;
    if (textureMode === LineTextureMode.TILE) return f(this.widthFactor / tileAspect);
    if (textureMode === LineTextureMode.STRETCH) return this.stretchedLineWidth();
    return 0;
  }

  /** The line's width at the current factor, as a share of the line's length. */
  private stretchedLineWidth(): number {
    return f(f(f(this.options.width) * this.widthFactor) / this.totalDistance);
  }

  /**
   * The quad and the joint at every interior point, and at every point of a closed line.
   */
  private addJoints(): void {
    const { points, wrapsAround } = this;
    const count = points.length;
    // A closed line starts with a walk from its last point that draws nothing, so its first joint is right.
    const lastIndex = wrapsAround ? count : count - 2;
    let first: FirstJoint | null = null;

    for (let i = wrapsAround ? -1 : 1; i <= lastIndex; i++) {
      const pos1 = points[i === -1 ? count - 1 : i % count]!;
      const pos2 = points[(i + 1) % count]!;
      if (i >= 1) this.distance = f(this.distance + vector2DistanceTo(this.pos0, pos1));
      const color1 = this.advanceAlongLine();

      const forward1 = normalizedVector2(vector2Sub(pos2, pos1));
      const normal1 = vector2Orthogonal(forward1);
      const joint = resolveJoint({
        pos0: this.pos0,
        pos1,
        pos2,
        forward1,
        normal0: this.normal0,
        normal1,
        halfWidth: this.modifiedHalfWidth,
        widthFactor: this.widthFactor,
        baseHalfWidthSq: f(this.halfWidth * this.halfWidth),
        sharpLimitSq: f(this.options.sharpLimit * this.options.sharpLimit),
        jointMode: this.options.jointMode,
      });
      this.uvx = this.uvxAtDistance();
      this.color0 = color1;
      this.pos0 = pos1;
      this.normal0 = normal1;
      this.forward0 = forward1;
      this.up0 = joint.nextUp0;
      this.down0 = joint.nextDown0;
      if (i === -1) continue;

      if (wrapsAround && i === 0) first = this.firstJointOf(joint);
      const isClosingJoint = wrapsAround && i === lastIndex;
      if (isClosingJoint && first && this.options.widthFactorAt && !first.isSharp) {
        // A width curve that does not meet itself ends on the first pair, scaled to the last width.
        if (first.pair) this.addClosingQuad(first.pair, color1);
        return;
      }
      stripAddQuad(this.strip, joint.up1, joint.down1, color1, this.uvx);
      this.addJointTriangles(joint, pos1, isClosingJoint, color1);
    }
  }

  /** The colour and the width factor at the distance walked, which is null and 1 where none is read. */
  private advanceAlongLine(): Rgba | null {
    if (!this.needsDistance) return null;
    const { gradient, widthFactorAt } = this.options;
    const offset = f(this.distance / this.totalDistance);
    if (widthFactorAt) this.widthFactor = widthFactorAt(offset);
    return gradient ? gradient.colorAt(offset) : null;
  }

  private firstJointOf(joint: Joint): FirstJoint {
    const isSharp = joint.jointMode === LineJointMode.SHARP;
    if (this.widthFactor === 0) return { pair: null, isSharp };
    const center = vector2Scaled(vector2Add(joint.up1, joint.down1), 0.5);
    const weight = f(1 / this.widthFactor);
    return {
      pair: { up: vector2Lerp(center, joint.up1, weight), down: vector2Lerp(center, joint.down1, weight) },
      isSharp,
    };
  }

  private addClosingQuad(first: { up: Vector2; down: Vector2 }, color: Rgba | null): void {
    const center = vector2Scaled(vector2Add(first.up, first.down), 0.5);
    const up = vector2Lerp(center, first.up, this.widthFactor);
    const down = vector2Lerp(center, first.down, this.widthFactor);
    stripAddQuad(this.strip, up, down, color, this.uvx);
  }

  /** The bevel triangle or the round fan that fills the outside of a corner (`line_builder.cpp:289-338`). */
  private addJointTriangles(joint: Joint, pos1: Vector2, isClosingJoint: boolean, color: Rgba | null): void {
    const { jointMode, orientation } = joint;
    if (jointMode === LineJointMode.SHARP) return;

    const [outerBegin, outerEnd] = orientation === UP ? [joint.down1, this.down0] : [joint.up1, this.up0];
    if (!isClosingJoint) {
      if (jointMode === LineJointMode.BEVEL) {
        stripAddTri(this.strip, outerEnd, orientation);
      } else if (jointMode === LineJointMode.ROUND) {
        this.addRoundJoint(pos1, vector2Sub(outerBegin, pos1), vector2Sub(outerEnd, pos1), orientation);
      }
    }
    // The joint is too corrupted to reuse, so the strip starts again at the fallback points.
    if (!joint.isIntersecting) stripBegin(this.strip, this.up0, this.down0, color, this.uvx);
  }

  private addRoundJoint(center: Vector2, begin: Vector2, end: Vector2, orientation: Orientation): void {
    // A cross product of -0 reads as 0, so a half turn sweeps +PI and not -PI (`line_builder.cpp:316-325`).
    const cross = vector2Cross(begin, end) || 0;
    const angleDelta = f(Math.atan2(cross, vector2Dot(begin, end)));
    stripAddArc(this.strip, center, angleDelta, orientation, this.options.roundPrecision);
  }

  /** The last segment, with the end cap (`line_builder.cpp:340-382`). */
  private addEndSegment(): void {
    const { endCapMode, gradient, roundPrecision } = this.options;
    const pos1 = this.points[this.points.length - 1]!;
    const color = gradient?.last ?? null;
    if (this.needsDistance) this.distance = f(this.distance + vector2DistanceTo(this.pos0, pos1));
    if (this.options.widthFactorAt) this.widthFactor = this.options.widthFactorAt(1);

    const reach = vector2Scaled(this.normal0, this.modifiedHalfWidth);
    let up1 = vector2Add(pos1, reach);
    let down1 = vector2Sub(pos1, reach);
    if (endCapMode === LineCapMode.BOX) {
      const forward = vector2Scaled(this.forward0, this.modifiedHalfWidth);
      up1 = vector2Add(up1, forward);
      down1 = vector2Add(down1, forward);
      this.distance = f(this.distance + this.modifiedHalfWidth);
    }
    const uvx = this.uvxAtDistance();
    stripAddQuad(this.strip, up1, down1, color, uvx);
    if (endCapMode === LineCapMode.ROUND) {
      const width = this.endCapUvWidth();
      const uvRect = { x: f(uvx - f(0.5 * width)), y: 0, width, height: 1 };
      newArc(this.strip, pos1, vector2Sub(up1, pos1), Math.PI, roundPrecision, color, uvRect);
    }
  }
}
