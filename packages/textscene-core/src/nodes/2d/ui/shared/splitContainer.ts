/**
 * Shared SplitContainer base for the HSplit/VSplit slices (the `boxContainer.ts`
 * pattern for a slice family). Pure `.ts` — no React, no THREE — so both
 * parsers can import it inside the linter graph.
 *
 * A SplitContainer is not a flow container. Godot's `_resort` solves for ONE
 * number and derives both rects from it (`scene/gui/split_container.cpp`):
 *
 *     fit_child_in_rect(first,  Rect2(Point2(0, 0), Size2(computed_split_offset, h)));
 *     int sofs = computed_split_offset + sep;
 *     fit_child_in_rect(second, Rect2(Point2(sofs, 0), Size2(w - sofs, h)));
 *
 * so the whole type reduces to `computed_split_offset` plus a separation, and
 * both are reproduced here in closed form rather than approximated with
 * flex-grow.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

/** Godot `Control.SizeFlags.SIZE_EXPAND`. */
const SIZE_FLAG_EXPAND = 2;

/**
 * `default_theme.cpp`'s `separation` constant for SplitContainer. Measured:
 * `unit-split-container.tscn`'s first row leaves a 12 px gap in Godot 4.6.3.
 */
export const DEFAULT_SEPARATION = 12;

/**
 * The default grabber icon's extent along the split axis — the floor
 * `_get_separation` puts under the theme constant:
 *
 *     return MAX(theme_cache.separation, vertical ? g->get_height() : g->get_width());
 *
 * Measured rather than read off the icon: the `SepZero` row overrides
 * `separation` to 0 and Godot still leaves an 8 px gap.
 */
export const GRABBER_EXTENT = 8;

/** Godot `SplitContainer.DraggerVisibility.DRAGGER_HIDDEN_COLLAPSED`. */
const DRAGGER_HIDDEN_COLLAPSED = 2;

export interface SplitContainerProperties extends ControlProperties {
  /** Pixels the split is displaced from its computed rest position (Godot default 0). */
  splitOffset?: number;
  /** True pins the split at its rest position — `split_offset` is not read at all. */
  collapsed?: boolean;
  /** 0=VISIBLE, 1=HIDDEN, 2=HIDDEN_COLLAPSED. Only 2 removes the separation. */
  draggerVisibility?: number;
}

export function parseSplitContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): SplitContainerProperties {
  const result: SplitContainerProperties = { ...parseControl(heading, properties) };
  result.splitOffset = parseOptionalInt(properties.split_offset);
  result.collapsed = parseOptionalBool(properties.collapsed);
  result.draggerVisibility = parseOptionalInt(properties.dragger_visibility);
  return result;
}

/**
 * `_get_separation()`. Only DRAGGER_HIDDEN_COLLAPSED removes the gap; plain
 * HIDDEN keeps it, which is the difference `unit-split-container.tscn`'s
 * `DraggerCollapsed` row pins (0 px there, 12 px everywhere else).
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
 * The first child's extent along the split axis, as a CSS length.
 *
 * `_compute_split_offset` is a function of the container's own size, which the
 * DOM only knows at layout time — so each branch is emitted as the `calc()`
 * that evaluates to the same number, with `100%` standing in for `size`:
 *
 *     both expanded   size * ratio - sep * 0.5 + split_offset
 *     first expanded  size - sep + split_offset
 *     otherwise       split_offset
 *
 * where `ratio = first.stretch_ratio / (first.stretch_ratio + second.stretch_ratio)`
 * and `split_offset` reads as 0 while `collapsed`.
 *
 * The `CLAMP(wished, first_min, size - sep - second_min)` that follows is NOT
 * in the expression — it needs both children's combined minimum sizes, which
 * are content measurements the DOM performs and CSS cannot name. `min-width`
 * on the tracks recovers the lower half of it.
 */
export function splitFirstExtent(
  props: SplitContainerProperties,
  first: ControlProperties | undefined,
  second: ControlProperties | undefined,
  vertical: boolean
): string {
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
