/**
 * Shared SplitContainer base for the HSplit/VSplit slices, in pure `.ts` that both parsers can
 * import inside the linter graph. Godot's `_resort` (`scene/gui/split_container.cpp`) derives both
 * rects from `computed_split_offset` and the separation, which this module reproduces in closed
 * form rather than approximating with flex-grow.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { packedArrayBody, packedArrayForms } from '../../../../godot/index.js';
import { ruleInt } from '../../../../godot/int.js';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

/** Godot `Control.SizeFlags.SIZE_EXPAND`. */
const SIZE_FLAG_EXPAND = 2;

/** `default_theme.cpp`'s SplitContainer `separation`. Measured: the probe scene's first row leaves a 12 px gap in Godot 4.6.3. */
export const DEFAULT_SEPARATION = 12;

/**
 * The default grabber's extent on the split axis, the floor `_get_separation` puts under the theme
 * constant: `MAX(theme_cache.separation, vertical ? g->get_height() : g->get_width())`. Measured:
 * the `SepZero` row overrides `separation` to 0 and Godot still leaves an 8 px gap.
 */
export const GRABBER_EXTENT = 8;

/** Godot `SplitContainer.DraggerVisibility.DRAGGER_HIDDEN_COLLAPSED`. */
const DRAGGER_HIDDEN_COLLAPSED = 2;

export interface SplitContainerProperties extends ControlProperties {
  /**
   * Pixels each dragger is displaced from its computed rest position, one
   * entry per dragger (Godot default `[0]`: the constructor pushes one zero,
   * `split_container.cpp:1336`). It carries whatever the deprecated scalar `split_offset`
   * wrote into entry 0.
   */
  splitOffsets?: number[];
  /** The deprecated scalar spelling alone (`split_container.cpp:1330`), for a reader that wants the authored key rather than the resolved array. */
  splitOffset?: number;
  /** True pins the split at its rest position, and `split_offset` is not read. */
  collapsed?: boolean;
  /** 0=VISIBLE, 1=HIDDEN, 2=HIDDEN_COLLAPSED. Only 2 removes the separation. */
  draggerVisibility?: number;
}

/** All three spellings a PACKED_INT32_ARRAY slot converts (`godot/variantParser.ts`). */
const SPLIT_OFFSETS_FORMS = packedArrayForms('PackedInt32Array');

/**
 * `split_offsets` and the deprecated `split_offset`, resolved as the engine does: the constructor
 * seeds `[0]` (`split_container.cpp:1336`), `set_split_offsets` replaces the array (`:1071-1077`)
 * and `set_split_offset` writes entry 0 (`:1056-1064`, from the compat property at `:1330`). The
 * saver writes `split_offsets` first (`:1295`), so file order decides and the bag is read in order.
 */
function parseSplitOffsets(properties: Record<string, string>): number[] | undefined {
  let offsets: number[] | undefined;
  for (const key of Object.keys(properties)) {
    if (key === 'split_offsets') {
      const matched = packedArrayBody(SPLIT_OFFSETS_FORMS, properties['split_offsets']!);
      if (!matched) continue;
      offsets = matched.body
        .split(',')
        .map((element) => element.trim())
        .filter((element) => element.length > 0)
        .map((element) => ruleInt(element) ?? 0);
    } else if (key === 'split_offset') {
      const scalar = parseOptionalInt(properties['split_offset']);
      if (scalar === undefined) continue;
      const base = offsets ?? [0];
      // `set_split_offset`'s `ERR_FAIL_INDEX(0, split_offsets.size())`: an explicitly empty array
      // has no entry 0, so it swallows the scalar.
      if (base.length === 0) continue;
      offsets = [...base];
      offsets[0] = scalar;
    }
  }
  return offsets;
}

export function parseSplitContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): SplitContainerProperties {
  const result: SplitContainerProperties = { ...parseControl(heading, properties) };
  result.splitOffset = parseOptionalInt(properties.split_offset);
  result.splitOffsets = parseSplitOffsets(properties);
  result.collapsed = parseOptionalBool(properties.collapsed);
  result.draggerVisibility = parseOptionalInt(properties.dragger_visibility);
  return result;
}

/** This container's authored offsets, or the constructor's own single zero (`split_container.cpp:1336`). */
export function splitOffsetsOf(props: SplitContainerProperties): readonly number[] {
  return props.splitOffsets ?? [props.splitOffset ?? 0];
}

/**
 * `_get_separation()`. Only DRAGGER_HIDDEN_COLLAPSED removes the gap, and plain HIDDEN keeps it:
 * the probe scene's `DraggerCollapsed` row has 0 px, every other row 12 px.
 */
export function splitSeparation(props: SplitContainerProperties): number {
  if (props.draggerVisibility === DRAGGER_HIDDEN_COLLAPSED) return 0;
  return Math.max(props.themeOverrideConstants?.separation ?? DEFAULT_SEPARATION, GRABBER_EXTENT);
}

/** Does this child claim the split axis? `SIZE_EXPAND` on the axis being split. */
function expandsOnAxis(child: ControlProperties | undefined, vertical: boolean): boolean {
  const flag = vertical ? child?.sizeFlagsVertical : child?.sizeFlagsHorizontal;
  return flag !== undefined && (flag & SIZE_FLAG_EXPAND) !== 0;
}

/**
 * The first child's extent on the split axis, as a CSS length. `_compute_split_offset` needs the
 * container size, so each branch is the `calc()` that evaluates to it with `100%` as `size`: both
 * expanded `size * ratio - sep * 0.5 + split_offset`, first expanded `size - sep + split_offset`,
 * else `split_offset`, which reads 0 while `collapsed`.
 */
export function splitFirstExtent(
  props: SplitContainerProperties,
  first: ControlProperties | undefined,
  second: ControlProperties | undefined,
  vertical: boolean
): string {
  // The `CLAMP(wished, first_min, size - sep - second_min)` needs both children's combined minimum
  // sizes, which CSS cannot name. `min-width` on the tracks recovers its lower half.
  const separation = splitSeparation(props);
  const offset = props.collapsed ? 0 : (props.splitOffset ?? 0);
  const firstExpands = expandsOnAxis(first, vertical);
  const secondExpands = expandsOnAxis(second, vertical);

  if (firstExpands && secondExpands) {
    const firstRatio = first?.sizeFlagsStretchRatio ?? 1;
    const secondRatio = second?.sizeFlagsStretchRatio ?? 1;
    const total = firstRatio + secondRatio;
    // Both ratios zero is Godot's own divide-by-zero; treat it as even, which
    // is what a 1:1 pair gives and the only non-NaN reading.
    const ratio = total > 0 ? firstRatio / total : 0.5;
    return `calc(${ratio * 100}% + ${offset - separation / 2}px)`;
  }
  if (firstExpands) return `calc(100% + ${offset - separation}px)`;
  return `${offset}px`;
}
