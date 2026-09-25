/**
 * Decoders for `Gradient` and `GradientTexture2D`, inline or from a `.tres`. Every
 * default is the value Godot's constructor installs (`scene/resources/gradient.cpp`,
 * `scene/resources/gradient_texture.cpp`): most resources omit most properties.
 * No THREE.
 */

import type { Color } from '../../../utils/colorParser';
import { warn } from '../../../logger.js';
import { enumOr, intOr, vec2Or } from '../../../parser/valueParsers';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import {
  GRADIENT_TEXTURE_MAX_SIZE,
  packedArrayBody,
  packedArrayForms,
  boolSlotValue,
} from '../../../godot/index.js';
import {
  floatElements,
  packedTupleNumbers,
  PACKED_COLOR_ARRAY_SPELLINGS,
} from '../../shapes/packedArray';
import {
  GradientFill,
  GradientInterpolationMode,
  GradientRepeat,
  type Gradient,
  type GradientColorStop,
  type GradientTexture2D,
} from './types';

// All three spellings each slot loads: `can_convert_strict` lists ARRAY as a source
// for every PACKED_* type (variant.cpp:467-473), and `Gradient::set_offsets`/`set_colors`
// take the packed arrays (gradient.cpp:80-81), so `colors = [Color(1, 0, 0, 1), …]` loads.
const OFFSETS_FORMS = packedArrayForms('PackedFloat32Array');

/** Parse a `PackedFloat32Array` slot, in any of its three spellings, into a `number[]`. */
export function parsePackedFloat32Array(value: string): number[] {
  const matched = packedArrayBody(OFFSETS_FORMS, value);
  if (!matched) {
    throw new Error(`Invalid PackedFloat32Array format: ${value}`);
  }
  // A scalar slot's bare and typed bodies are the same comma-separated numbers
  // the constructor's flat argument list holds, so one reader covers all three.
  if (matched.body === '') return [];
  return floatElements(matched.body, 'PackedFloat32Array', value);
}

/**
 * Parses a `PackedColorArray` slot into a `Color[]`, dropping a trailing partial
 * quadruple. It groups the output of `parsePackedColorArray`
 * (`resources/shapes/packedArray.ts`), and a distinct name keeps the two contracts apart.
 */
export function parseColorStops(value: string): Color[] {
  const nums = packedTupleNumbers(value, 'PackedColorArray', PACKED_COLOR_ARRAY_SPELLINGS, 4);
  const colors: Color[] = [];
  for (let i = 0; i + 3 < nums.length; i += 4) {
    colors.push({ r: nums[i]!, g: nums[i + 1]!, b: nums[i + 2]!, a: nums[i + 3]! });
  }
  return colors;
}

/**
 * Pairs `offsets` with `colors` into sorted stops. Absent `offsets` spreads the
 * stops evenly across 0..1, the default two-point spacing. Mismatched lengths
 * use the shorter of the two.
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
  // Godot sorts points by offset before sampling. A stable sort keeps equal
  // offsets in authored order, as the binary search expects.
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
 * The `Gradient` a `SubResource("id")` property names, or null for anything else.
 * CPUParticles2D takes a bare `Gradient`, not a `GradientTexture1D`, so its
 * colour ramp resolves here, not through the texture path.
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
 * The `Gradient` a standalone resource file carries, or null for another type.
 * Its `[resource]` body decodes through the same `decodeGradient` as an inline block.
 */
export function gradientFromResource(parsed: ParsedResource): Gradient | null {
  if (parsed.resourceType !== 'Gradient') return null;
  return decodeGradient(parsed.properties);
}

/** `width = 64` and `height = 64` (`gradient_texture.h:92-93`). */
const DEFAULT_TEXTURE_SIZE = 64;

/**
 * A `GradientTexture2D` sub-resource. The caller resolves the `gradient` ref.
 * Defaults: 64×64, linear fill, from (0,0) to (1,0), no repeat, LDR.
 */
export function decodeGradientTexture2D(data: Record<string, string>): GradientTexture2D {
  return {
    width: textureSizeAxis(data.width, 'GradientTexture2D.width'),
    height: textureSizeAxis(data.height, 'GradientTexture2D.height'),
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

/**
 * `set_width` and `set_height` refuse an axis outside 1 to `GRADIENT_TEXTURE_MAX_SIZE`
 * (`gradient_texture.cpp:324`, `:335`), and a refused write keeps the default.
 */
function textureSizeAxis(raw: string | undefined, context: string): number {
  const value = intOr(raw, DEFAULT_TEXTURE_SIZE, context);
  if (value >= 1 && value <= GRADIENT_TEXTURE_MAX_SIZE) return value;
  warn(`${context}: Godot's setter refuses ${value}, keeping the default ${DEFAULT_TEXTURE_SIZE}`);
  return DEFAULT_TEXTURE_SIZE;
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
