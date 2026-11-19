/**
 * Decoders for `Gradient` and `GradientTexture2D`, inline or from a `.tres`. Every
 * default is the value Godot's constructor installs (`scene/resources/gradient.cpp`,
 * `scene/resources/gradient_texture.cpp`): most resources omit most properties.
 * No THREE.
 */

import { enumOr, settableIntOr, vec2Or, type SetterRange } from '../../../parser/valueParsers';
import type { ResourceKind } from '../../reading';
import {
  GRADIENT_TEXTURE_MAX_SIZE,
  GradientColorSpace,
  GradientTexture2DFill,
  GradientInterpolationMode,
  GradientTexture2DRepeat,
} from '../../../godot/scene/gradientTexture.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { parsePackedColorArray, parsePackedFloat32Array } from '../../shapes/packedArray';
import { type Gradient, type GradientColorStop, type GradientTexture2D } from './types';
import type { Rgba } from '../../../godot/math/math.js';

/**
 * Parses a `PackedColorArray` slot into a `Color[]`, dropping a trailing partial quadruple. It
 * groups the output of `parsePackedColorArray`, so each component is the float32 a `Color` stores
 * (`core/math/color.h:42-45`).
 */
function parseColorStops(value: string): Rgba[] {
  const nums = parsePackedColorArray(value);
  const colors: Rgba[] = [];
  for (let i = 0; i + 3 < nums.length; i += 4) {
    colors.push({ r: nums[i]!, g: nums[i + 1]!, b: nums[i + 2]!, a: nums[i + 3]! });
  }
  return colors;
}

/** A `Point` that `resize` adds: offset 0 and `Color()` (`gradient.h:54-56`). */
const ADDED_POINT: GradientColorStop = { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } };

/** `Gradient::Gradient()` (`gradient.cpp:35-42`). */
const DEFAULT_STOPS: readonly GradientColorStop[] = [
  { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
  { offset: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
];

/** Offsets, then colours, as the saver orders them (`gradient.cpp:80-81`); each resizes the points. */
function decodeGradient(data: Readonly<Record<string, string>>): Gradient {
  let stops: GradientColorStop[] = [...DEFAULT_STOPS];
  const offsets = data.offsets ? safeOffsets(data.offsets) : null;
  if (offsets) {
    // A `Point` stores its offset as a float (`gradient.h:55`).
    stops = offsets.map((offset, i) => ({ ...(stops[i] ?? ADDED_POINT), offset: Math.fround(offset) }));
  }
  const colors = data.colors ? safeColors(data.colors) : null;
  if (colors) stops = colors.map((color, i) => ({ ...(stops[i] ?? ADDED_POINT), color }));
  // Godot sorts points by offset before sampling. A stable sort keeps equal
  // offsets in authored order, as the binary search expects.
  stops.sort((a, b) => a.offset - b.offset);

  return {
    stops,
    interpolationMode: enumOr(
      data.interpolation_mode,
      GradientInterpolationMode.LINEAR,
      [GradientInterpolationMode.LINEAR, GradientInterpolationMode.CONSTANT, GradientInterpolationMode.CUBIC],
      'Gradient.interpolation_mode'
    ),
    interpolationColorSpace: enumOr(
      data.interpolation_color_space,
      GradientColorSpace.SRGB,
      [GradientColorSpace.SRGB, GradientColorSpace.LINEAR_SRGB, GradientColorSpace.OKLAB],
      'Gradient.interpolation_color_space'
    ),
  };
}

/** A `Gradient` from any origin: the ramp of a particle emitter. Another class draws nothing. */
export const GRADIENT: ResourceKind<Gradient> = {
  name: 'Gradient',
  accepts: (type) => type === 'Gradient',
  decode: (held) => decodeGradient(held.properties),
};

/** `width = 64` and `height = 64` (`gradient_texture.h:92-93`). */
const DEFAULT_TEXTURE_SIZE = 64;

/**
 * `set_width` and `set_height` refuse an axis outside 1 to `GRADIENT_TEXTURE_MAX_SIZE`
 * (`gradient_texture.cpp:324`, `:335`).
 */
const TEXTURE_SIZE_RANGE: SetterRange = { min: 1, max: GRADIENT_TEXTURE_MAX_SIZE };

/**
 * A `GradientTexture2D` sub-resource. The caller resolves the `gradient` ref.
 * Defaults: 64×64, linear fill, from (0,0) to (1,0), no repeat, LDR.
 */
export function decodeGradientTexture2D(data: Record<string, string>): GradientTexture2D {
  return {
    width: settableIntOr(data.width, DEFAULT_TEXTURE_SIZE, TEXTURE_SIZE_RANGE, 'GradientTexture2D.width'),
    height: settableIntOr(data.height, DEFAULT_TEXTURE_SIZE, TEXTURE_SIZE_RANGE, 'GradientTexture2D.height'),
    fill: enumOr(
      data.fill,
      GradientTexture2DFill.LINEAR,
      [GradientTexture2DFill.LINEAR, GradientTexture2DFill.RADIAL, GradientTexture2DFill.SQUARE],
      'GradientTexture2D.fill'
    ),
    fillFrom: vec2Or(data.fill_from, { x: 0, y: 0 }, 'GradientTexture2D.fill_from'),
    fillTo: vec2Or(data.fill_to, { x: 1, y: 0 }, 'GradientTexture2D.fill_to'),
    repeat: enumOr(
      data.repeat,
      GradientTexture2DRepeat.NONE,
      [GradientTexture2DRepeat.NONE, GradientTexture2DRepeat.REPEAT, GradientTexture2DRepeat.MIRROR],
      'GradientTexture2D.repeat'
    ),
    useHdr: boolSlotValue(data.use_hdr) === true,
  };
}

function safeColors(value: string): Rgba[] | null {
  try {
    return parseColorStops(value);
  } catch {
    return null;
  }
}

function safeOffsets(value: string): number[] | null {
  try {
    return parsePackedFloat32Array(value);
  } catch {
    return null;
  }
}
