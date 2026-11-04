/**
 * The coordinates of a font instance: Godot's design coordinates from a `variation_opentype`
 * dictionary, and the normalised ones FreeType draws with.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { OPENTYPE_NAME_BY_TAG } from '../../../../../godot/text/openTypeNames';
import { ftDivFix, ftMulDiv, type OpentypeCoordinates } from '../fontMetrics';
import type { AxisSegment, AxisVariations } from './avar';
import { tagString, type FvarAxis } from './fvar';
import { itemDelta, mappedItem } from './itemVariationStore';

/** `TextServerAdvanced::_tag_to_name` (`text_server_adv.cpp:810-821`): the name a tag has, or `custom_` and the tag. */
function axisName(tag: number): string {
  const text = tagString(tag);
  return OPENTYPE_NAME_BY_TAG[text] ?? `custom_${text}`;
}

/** The `hb_variation_t` value: a float, as `FontVariation` stores `float` coordinates. */
const asFloat = Math.fround;

/** `CLAMP(value * 65536.0, minimum, maximum)` assigned to an `FT_Fixed`, which truncates. */
function clampedFixed(value: number, axis: FvarAxis): number {
  const scaled = asFloat(value) * 0x10000;
  if (Number.isNaN(scaled)) return axis.defaultValue;
  return Math.trunc(scaled < axis.minimum ? axis.minimum : scaled > axis.maximum ? axis.maximum : scaled);
}

/**
 * The design coordinate of each axis, in 16.16, as `TextServerAdvanced` sets them
 * (`text_server_adv.cpp:1915-1950`): the default, then the value under the tag, then the value under
 * the axis name, each clamped to the axis range.
 */
export function designCoordinates(axes: readonly FvarAxis[], opentype: OpentypeCoordinates): number[] {
  return axes.map((axis) => {
    let coordinate = axis.defaultValue;
    for (const key of [axis.tag, axisName(axis.tag)]) {
      const value = opentype.get(key);
      if (value !== undefined) coordinate = clampedFixed(value, axis);
    }
    return coordinate;
  });
}

/** The coordinate in `[-1, 1]` that the range of the axis puts a design coordinate at (`ft_var_to_normalized`). */
function normalizedInRange(coordinate: number, axis: FvarAxis): number {
  if (coordinate > axis.defaultValue)
    return coordinate >= axis.maximum
      ? 0x10000
      : ftDivFix(coordinate - axis.defaultValue, axis.maximum - axis.defaultValue);
  if (coordinate < axis.defaultValue)
    return coordinate <= axis.minimum
      ? -0x10000
      : ftDivFix(coordinate - axis.defaultValue, axis.defaultValue - axis.minimum);
  return 0;
}

/** The first segment above `coordinate` maps it by linear interpolation; one past the last segment leaves it. */
function segmentMapped(coordinate: number, segment: AxisSegment): number {
  for (let pair = 1; pair < segment.length; pair++) {
    const upper = segment[pair]!;
    if (coordinate >= upper.from) continue;
    const lower = segment[pair - 1]!;
    return ftMulDiv(coordinate - lower.from, upper.to - lower.to, upper.from - lower.from) + lower.to;
  }
  return coordinate;
}

/** `ft_var_to_normalized`: the design coordinates in 16.16 as FreeType normalises them, through `avar` when the font has it. */
export function normalizedCoordinates(
  axes: readonly FvarAxis[],
  design: readonly number[],
  avar: AxisVariations | null
): Int32Array {
  const ranged = axes.map((axis, index) => normalizedInRange(design[index]!, axis));
  const segmented = avar?.segments
    ? ranged.map((value, index) => segmentMapped(value, avar.segments![index]!))
    : ranged;
  const normalized = Int32Array.from(segmented);
  if (!avar?.store) return normalized;

  // The store reads the half-normalised coordinates, which every axis then replaces at once.
  const halfNormalized = Int32Array.from(normalized);
  normalized.forEach((value, axis) => {
    const [outer, inner] = mappedItem(avar.axisMap, axis);
    const delta = itemDelta(avar.store!, outer, inner, halfNormalized) | 0;
    normalized[axis] = Math.max(-0x10000, Math.min(0x10000, value + delta * 4));
  });
  return normalized;
}
