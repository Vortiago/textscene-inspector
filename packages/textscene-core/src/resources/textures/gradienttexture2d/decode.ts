/**
 * Decoders for the slice's two claimed types, `Gradient` and
 * `GradientTexture2D`, whichever serialization they arrived in — an inline
 * `[sub_resource]` block or the `[resource]` body of a standalone `.tres`.
 *
 * Every default below is the value Godot's own constructor installs
 * (`scene/resources/gradient.cpp`, `scene/resources/gradient_texture.cpp`) — a
 * resource that omits a property is the common case (the coin's texture sets
 * only `fill`/`fill_from`/`fill_to`), so getting the defaults wrong is
 * indistinguishable from getting the fill wrong.
 *
 * Pure `.ts`, no THREE — `sample.ts` evaluates these typed values and `build.ts`
 * rasterises them.
 */

import type { Color } from '../../../utils/colorParser';
import { enumOr, intOr, vec2Or } from '../../../parser/valueParsers';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { packedArrayLiteral, boolSlotValue} from '../../../godot/index.js';
import { floatElements } from '../../shapes/packedArray';
import {
  GradientFill,
  GradientInterpolationMode,
  GradientRepeat,
  type Gradient,
  type GradientColorStop,
  type GradientTexture2D,
} from './types';

const PACKED_FLOAT32_ARRAY_RE = packedArrayLiteral('PackedFloat32Array');
const PACKED_COLOR_ARRAY_RE = packedArrayLiteral('PackedColorArray');

/** Parse a `PackedFloat32Array(a, b, c)` literal into a `number[]`. */
export function parsePackedFloat32Array(value: string): number[] {
  const match = value.match(PACKED_FLOAT32_ARRAY_RE);
  if (!match) {
    throw new Error(`Invalid PackedFloat32Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return [];
  return floatElements(inner, 'PackedFloat32Array', value);
}

/**
 * Parse a `PackedColorArray(r, g, b, a, r, g, b, a, …)` literal into a
 * `Color[]`. A trailing partial quadruple is dropped.
 *
 * Named apart from `parsePackedColorArray` in `resources/shapes/packedArray.ts`,
 * which reads the same literal into a flat `Float32Array`: two exports under
 * one name were two contracts a caller had to pick between by import path.
 */
export function parseColorStops(value: string): Color[] {
  const match = value.match(PACKED_COLOR_ARRAY_RE);
  if (!match) {
    throw new Error(`Invalid PackedColorArray format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return [];
  const nums = floatElements(inner, 'PackedColorArray', value);
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
export function decodeGradient(data: Record<string, string>): Gradient {
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

/**
 * The `Gradient` a `SubResource("id")` property names, or null when the
 * reference is absent, is not a SubResource, names nothing, or names something
 * else. Godot's CPUParticles2D takes a bare `Gradient` (not the
 * `GradientTexture1D` its GPU sibling uses), so a colour ramp resolves through
 * here rather than through the texture path.
 */
export function resolveGradient(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Gradient | null {
  const resource = resolveSubResourceRef(ref, internalResources);
  if (resource?.type !== 'Gradient') return null;
  return decodeGradient(resource.data as Record<string, string>);
}

/**
 * The `Gradient` a standalone resource file carries, or null when the file is
 * some other resource type. The `[resource]` body holds exactly the properties
 * an inline `[sub_resource type="Gradient"]` block does, so it decodes through
 * the same `decodeGradient`.
 */
export function gradientFromResource(parsed: ParsedResource): Gradient | null {
  if (parsed.resourceType !== 'Gradient') return null;
  return decodeGradient(parsed.properties);
}

/** Decode a `GradientTexture2D` sub-resource (the `gradient` ref is resolved
 *  separately by the caller). Defaults: 64×64, linear fill, from (0,0) to
 *  (1,0), no repeat, LDR. */
export function decodeGradientTexture2D(data: Record<string, string>): GradientTexture2D {
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
    useHdr: boolSlotValue(data.use_hdr) === true,
  };
}

function safeColors(value: string): Color[] {
  try {
    return parseColorStops(value);
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
