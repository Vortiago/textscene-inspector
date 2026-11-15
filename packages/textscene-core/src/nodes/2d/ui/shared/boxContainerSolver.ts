/**
 * BoxContainer's native rect solve, shared by HBoxContainer and VBoxContainer, which differ only
 * in `vertical`: `BoxContainer::get_minimum_size` (`scene/gui/box_container.cpp`) and the layout
 * that hands each sortable child to `_resort` (`boxContainerResort.ts`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import { resortBoxContainer, type BoxChildInput } from './boxContainerResort';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { ControlProperties } from '../control/types';
import type { BoxContainerProperties } from './boxContainer';
import { isSortableControl } from './fitChildInRect';
import type { Vector2 } from '../../../../godot/math/vector';
import { DEFAULT_SIZE_FLAGS } from '../../../../godot/scene/control';

/** `Control::stretch_ratio` default (`control.h:231`). */
const DEFAULT_STRETCH_RATIO = 1;

/**
 * `BoxContainer::get_minimum_size` (`box_container.cpp:238-271`): main axis
 * sums each child's minimum plus one `separation` between consecutive
 * children; cross axis is the largest child.
 */
export function boxContainerMinimumSize(
  vertical: boolean,
  separation: number,
  childMinSizes: readonly Vector2[]
): Vector2 {
  let mainAxis = 0;
  let crossAxis = 0;

  childMinSizes.forEach((size, i) => {
    const sep = i === 0 ? 0 : separation;
    // `Size2i size = c->get_combined_minimum_size()` (`box_container.cpp`):
    // the child's minimum is truncated before it is accumulated, and the
    // accumulator is a `Size2i` too. Every real text minimum is fractional.
    const w = Math.trunc(size.x);
    const h = Math.trunc(size.y);
    if (vertical) {
      crossAxis = Math.max(crossAxis, w);
      mainAxis += h + sep;
    } else {
      crossAxis = Math.max(crossAxis, h);
      mainAxis += w + sep;
    }
  });

  return vertical ? { x: crossAxis, y: mainAxis } : { x: mainAxis, y: crossAxis };
}

function separationOf(n: SolveNode): number {
  return requiredThemeItem(n.constants, 'separation');
}

/** `BoxContainer::AlignmentMode`: absent/out-of-range treated as `ALIGNMENT_BEGIN` (Godot default `0`, `box_container.h`). */
function alignmentOf(n: SolveNode): 0 | 1 | 2 {
  const alignment = (n.node.properties as BoxContainerProperties).alignment;
  return alignment === 1 || alignment === 2 ? alignment : 0;
}

function toChildInput(node: SolveNode, minSize: Vector2): BoxChildInput {
  const props = node.node.properties as ControlProperties;
  return {
    minSize,
    hSizeFlags: props.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS,
    vSizeFlags: props.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS,
    stretchRatio: props.sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO,
  };
}

/**
 * Builds the `ContainerLayoutFn` for a box axis. BoxContainer has no chrome, so only the content
 * rect's width and height are read: its `x`/`y` place this node in its parent, and every rect is
 * local. An invisible child (`isSortableControl`, `_resort`'s first filter) claims no slot,
 * separation or stretch share, and `controlRectSolver.ts` floors it to an unpainted zero rect.
 */
export function makeBoxContainerLayout(vertical: boolean): ContainerLayoutFn {
  return (n, children, contentRect) => {
    const separation = separationOf(n);
    const alignment = alignmentOf(n);
    const sortable = children.filter(({ node }) => isSortableControl(node));
    const inputs = sortable.map(({ node, minSize }) => toChildInput(node, minSize));

    const rects = resortBoxContainer(
      vertical,
      { width: contentRect.w, height: contentRect.h },
      separation,
      alignment,
      n.rtl,
      inputs
    );

    const out = new Map<string, Rect2>();
    sortable.forEach(({ node: child }, i) => out.set(child.path, rects[i]!));
    return out;
  };
}

/** Builds the `MinimumSizeFn` for a box axis: this container's own contribution to `Control::get_combined_minimum_size` when it is itself a child. The same sortable-child filter as the layout (`BoxContainer::get_minimum_size` skips invisible children too). */
export function makeBoxContainerMinimumSize(vertical: boolean): MinimumSizeFn {
  return (n, ctx) => {
    const separation = separationOf(n);
    const childMinSizes = n.children.filter(isSortableControl).map((child) => ctx.combinedMinimumSize(child));
    return boxContainerMinimumSize(vertical, separation, childMinSizes);
  };
}
