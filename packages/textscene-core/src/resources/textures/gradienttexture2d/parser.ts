/**
 * Decoders for `Gradient` and `GradientTexture2D` sub-resource blocks.
 *
 * Every default below is the value Godot's own constructor installs
 * (`scene/resources/gradient.cpp`, `scene/resources/gradient_texture.cpp`) — a
 * resource that omits a property is the common case (the coin's texture sets
 * only `fill`/`fill_from`/`fill_to`), so getting the defaults wrong is
 * indistinguishable from getting the fill wrong.
 *
 * Pure `.ts`, no THREE — the rasteriser in `renderer.ts` consumes these typed
 * values.
 */

import type { Color } from '../../../utils/colorParser';
import { enumOr, intOr, vec2Or } from '../../../parser/valueParsers';
import {
  GradientFill,
  GradientInterpolationMode,
  GradientRepeat,
  type Gradient,
  type GradientColorStop,
  type GradientTexture2D,
} from './types';

/** Parse a `PackedFloat32Array(a, b, c)` literal into a `number[]`. */
export function parsePackedFloat32Array(value: string): number[] {
  const match = value.match(/^PackedFloat32Array\s*\(([\s\S]*)\)$/);
  if (!match) {
    throw new Error(`Invalid PackedFloat32Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return [];
  const nums = inner.split(',').map((s) => parseFloat(s.trim()));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid number in PackedFloat32Array: ${value}`);
  }
  return nums;
}

/**
 * Parse a `PackedColorArray(r, g, b, a, r, g, b, a, …)` literal — a flat run of
 * float quadruples — into a `Color[]`. A trailing partial quadruple is dropped.
 */
export function parsePackedColorArray(value: string): Color[] {
  const match = value.match(/^PackedColorArray\s*\(([\s\S]*)\)$/);
  if (!match) {
    throw new Error(`Invalid PackedColorArray format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return [];
  const nums = inner.split(',').map((s) => parseFloat(s.trim()));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid number in PackedColorArray: ${value}`);
  }
  const colors: Color[] = [];
  for (let i = 0; i + 3 < nums.length; i += 4) {
    colors.push({ r: nums[i]!, g: nums[i + 1]!, b: nums[i + 2]!, a: nums[i + 3]! });
  }
  return colors;
}

/**
 * Decode a `Gradient` sub-resource. Pairs `offsets` with `colors` into sorted
 * stops. When `offsets` is absent (Godot keeps it implicit for a bare
 * `colors =` assignment), the stops are spread evenly across 0..1, which is the
 * default two-point gradient's spacing and the correct reading for N colours.
 * Mismatched lengths fall back to the shorter of the two.
 */
export function parseGradient(data: Record<string, string>): Gradient {
  const colors = data.colors ? safeColors(data.colors) : [];
  const offsets = data.offsets ? safeOffsets(data.offsets) : null;

  const count = offsets ? Math.min(offsets.length, colors.length) : colors.length;
  const stops: GradientColorStop[] = [];
  for (let i = 0; i < count; i++) {
    const offset = offsets
      ? offsets[i]!
      : count > 1
        ? i / (count - 1)
        : 0;
    stops.push({ offset, color: colors[i]! });
  }
  // Godot sorts points by offset before sampling; a stable ascending sort keeps
  // equal-offset stops in authored order (matching the binary search).
  stops.sort((a, b) => a.offset - b.offset);

  return {
    stops,
    interpolationMode: enumOr(
      data.interpolation_mode,
      GradientInterpolationMode.Linear,
      [
        GradientInterpolationMode.Linear,
        GradientInterpolationMode.Constant,
        GradientInterpolationMode.Cubic,
      ],
      'Gradient.interpolation_mode'
    ),
  };
}

/** Decode a `GradientTexture2D` sub-resource (the `gradient` ref is resolved
 *  separately by the caller). Defaults: 64×64, linear fill, from (0,0) to
 *  (1,0), no repeat, LDR. */
export function parseGradientTexture2D(data: Record<string, string>): GradientTexture2D {
  return {
    width: Math.max(1, intOr(data.width, 64, 'GradientTexture2D.width')),
    height: Math.max(1, intOr(data.height, 64, 'GradientTexture2D.height')),
    fill: enumOr(
      data.fill,
      GradientFill.Linear,
      [GradientFill.Linear, GradientFill.Radial, GradientFill.Square],
      'GradientTexture2D.fill'
    ),
    fillFrom: vec2Or(data.fill_from, { x: 0, y: 0 }, 'GradientTexture2D.fill_from'),
    fillTo: vec2Or(data.fill_to, { x: 1, y: 0 }, 'GradientTexture2D.fill_to'),
    repeat: enumOr(
      data.repeat,
      GradientRepeat.None,
      [GradientRepeat.None, GradientRepeat.Repeat, GradientRepeat.Mirror],
      'GradientTexture2D.repeat'
    ),
    useHdr: data.use_hdr === 'true',
  };
}

function safeColors(value: string): Color[] {
  try {
    return parsePackedColorArray(value);
  } catch {
    return [];
  }
}

function safeOffsets(value: string): number[] | null {
  try {
    return parsePackedFloat32Array(value);
  } catch {
    return null;
  }
}
