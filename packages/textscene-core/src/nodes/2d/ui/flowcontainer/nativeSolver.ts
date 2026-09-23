/**
 * FlowContainer's native rect solve: a port of `FlowContainer::_resort` and
 * `FlowContainer::get_minimum_size` (`scene/gui/flow_container.cpp`), with the
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) each child passes through.
 *
 * `_resort` works in `int`, `Size2i` and `Vector2i`, so each float intermediate is
 * truncated toward zero: `Math.trunc`, not `Math.floor`, which differs where
 * `stretch_avail` goes negative on an overflowing line.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { isZeroApprox } from '../../../../godot/math';
import type { ControlProperties } from '../control/types';
import type { FlowContainerProperties } from './types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { SIZE_EXPAND, SIZE_FILL, SIZE_SHRINK_CENTER, SIZE_SHRINK_END, fitChildInRect, hasFlag, isSortableControl } from '../shared/fitChildInRect';

// FlowContainer::AlignmentMode (flow_container.h:39-43).
const ALIGNMENT_BEGIN = 0;
const ALIGNMENT_CENTER = 1;
const ALIGNMENT_END = 2;

// FlowContainer::LastWrapAlignmentMode (flow_container.h:44-49).
const LAST_WRAP_ALIGNMENT_INHERIT = 0;
const LAST_WRAP_ALIGNMENT_BEGIN = 1;
const LAST_WRAP_ALIGNMENT_CENTER = 2;
const LAST_WRAP_ALIGNMENT_END = 3;

// Control's stretch-ratio default (control.cpp:1868-1878, "1.0").
const DEFAULT_STRETCH_RATIO = 1;
const DEFAULT_SIZE_FLAGS = SIZE_FILL;

function props(n: SolveNode): FlowContainerProperties {
  return n.node.properties as FlowContainerProperties;
}

function hFlagsOf(n: SolveNode): number {
  return (n.node.properties as ControlProperties).sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
}

function vFlagsOf(n: SolveNode): number {
  return (n.node.properties as ControlProperties).sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
}

function stretchRatioOf(n: SolveNode): number {
  return (n.node.properties as ControlProperties).sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO;
}

/**
 * One solver serves all three types. `HFlowContainer` and `VFlowContainer` fix `vertical` in
 * their constructors and hide the property (`flow_container.h:99-113`), so their type name decides.
 */
function orientationOf(n: SolveNode): boolean {
  if (n.node.type === 'HFlowContainer') return false;
  if (n.node.type === 'VFlowContainer') return true;
  return props(n).vertical === true;
}

function separationOf(n: SolveNode, key: 'h_separation' | 'v_separation', theme: NativeTheme): number {
  return n.constants[key] ?? theme.separation;
}

// The shared line-wrap pass (flow_container.cpp:65-129).

interface ChildMsc {
  /** Combined minimum size, truncated to `Size2i` (`:72`). */
  msc: Vec2;
  /** The child's size flags on the main axis have `SIZE_EXPAND`. */
  mainExpand: boolean;
  stretchRatio: number;
}

interface LineData {
  childCount: number;
  minLineHeight: number;
  minLineLength: number;
  stretchAvail: number;
  stretchRatioTotal: number;
  isFilled: boolean;
}

/**
 * The first pass of `FlowContainer::_resort` (`flow_container.cpp:65-129`): one `LineData`
 * per wrapped line, and `cached_size` (`:262`). The wrap check also runs on an empty line,
 * so a first child wider than the container pushes an empty line before its own, as
 * Godot does.
 */
function computeLines(
  children: readonly ChildMsc[],
  vertical: boolean,
  hSep: number,
  vSep: number,
  currentContainerSize: number
): { lines: LineData[]; cachedSize: number } {
  const lines: LineData[] = [];
  let ofsX = 0;
  let ofsY = 0;
  let lineHeight = 0;
  let lineLength = 0;
  let lineStretchRatioTotal = 0;
  let childrenInCurrentLine = 0;
  let lastMsc: Vec2 | null = null;

  const pushLine = (isFilled: boolean) => {
    lines.push({
      childCount: childrenInCurrentLine,
      minLineHeight: lineHeight,
      minLineLength: lineLength,
      stretchAvail: currentContainerSize - lineLength,
      stretchRatioTotal: lineStretchRatioTotal,
      isFilled,
    });
  };

  for (const child of children) {
    if (vertical) {
      if (childrenInCurrentLine > 0) ofsY += vSep;
      if (ofsY + child.msc.y > currentContainerSize) {
        lineLength = ofsY - vSep;
        pushLine(true);
        ofsX += lineHeight + hSep;
        ofsY = 0;
        lineHeight = 0;
        lineStretchRatioTotal = 0;
        childrenInCurrentLine = 0;
      }
      lineHeight = Math.max(lineHeight, child.msc.x);
      if (child.mainExpand) lineStretchRatioTotal += child.stretchRatio;
      ofsY += child.msc.y;
    } else {
      if (childrenInCurrentLine > 0) ofsX += hSep;
      if (ofsX + child.msc.x > currentContainerSize) {
        lineLength = ofsX - hSep;
        pushLine(true);
        ofsY += lineHeight + vSep;
        ofsX = 0;
        lineHeight = 0;
        lineStretchRatioTotal = 0;
        childrenInCurrentLine = 0;
      }
      lineHeight = Math.max(lineHeight, child.msc.y);
      if (child.mainExpand) lineStretchRatioTotal += child.stretchRatio;
      ofsX += child.msc.x;
    }

    lastMsc = child.msc;
    childrenInCurrentLine++;
  }

  lineLength = vertical ? ofsY : ofsX;
  let isFilled = false;
  if (lastMsc !== null) {
    isFilled = vertical ? ofsY + lastMsc.y > currentContainerSize : ofsX + lastMsc.x > currentContainerSize;
  }
  pushLine(isFilled);

  const cachedSize = (vertical ? ofsX : ofsY) + lineHeight;
  return { lines, cachedSize };
}

function buildChildMscs(entries: readonly { node: SolveNode; minSize: Vec2 }[], vertical: boolean): ChildMsc[] {
  return entries.map(({ node, minSize }) => ({
    msc: { x: Math.trunc(minSize.x), y: Math.trunc(minSize.y) },
    mainExpand: hasFlag(vertical ? vFlagsOf(node) : hFlagsOf(node), SIZE_EXPAND),
    stretchRatio: stretchRatioOf(node),
  }));
}

/**
 * `FlowContainer::get_minimum_size` (`flow_container.cpp:267-289`): the main axis is
 * the widest child minimum, and the cross axis is `cached_size`. With no sortable
 * child both are 0.
 */
export const flowContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const vertical = orientationOf(n);
  const sortable = n.children.filter(isSortableControl);
  if (sortable.length === 0) return { x: 0, y: 0 };

  const hSep = separationOf(n, 'h_separation', ctx.theme);
  const vSep = separationOf(n, 'v_separation', ctx.theme);

  let mainAxisMax = 0;
  const childMscs: ChildMsc[] = [];
  for (const child of sortable) {
    const s = ctx.combinedMinimumSize(child);
    const msc = { x: Math.trunc(s.x), y: Math.trunc(s.y) };
    mainAxisMax = Math.max(mainAxisMax, vertical ? msc.y : msc.x);
    childMscs.push({
      msc,
      mainExpand: hasFlag(vertical ? vFlagsOf(child) : hFlagsOf(child), SIZE_EXPAND),
      stretchRatio: stretchRatioOf(child),
    });
  }

  // `cached_size` (`flow_container.h:52`, default 0) depends on the node's own size, so the
  // size-dependent registration below runs a second pass with `tentativeRect`. The first
  // pass has no size and uses Infinity, which never wraps: Godot's 0 would collapse the rect.
  const tentative = ctx.tentativeRect?.(n);
  const currentContainerSize = tentative
    ? Math.trunc(vertical ? tentative.h : tentative.w)
    : Number.POSITIVE_INFINITY;

  const { cachedSize } = computeLines(childMscs, vertical, hSep, vSep, currentContainerSize);

  return vertical ? { x: cachedSize, y: mainAxisMax } : { x: mainAxisMax, y: cachedSize };
};

controlSolverRegistry.registerMinimumSize('FlowContainer', flowContainerMinimumSize);
controlSolverRegistry.registerMinimumSize('HFlowContainer', flowContainerMinimumSize);
controlSolverRegistry.registerMinimumSize('VFlowContainer', flowContainerMinimumSize);
controlSolverRegistry.registerSizeDependentMinimum('FlowContainer');
controlSolverRegistry.registerSizeDependentMinimum('HFlowContainer');
controlSolverRegistry.registerSizeDependentMinimum('VFlowContainer');

/**
 * The alignment offset of the first child of a line with no expanding child
 * (`flow_container.cpp:159-205`). `last_wrap_alignment` applies only to the last line:
 * every other line is pushed with `is_filled = true`.
 */
function alignmentOffset(
  alignment: number,
  lastWrapAlignment: number,
  lineData: LineData,
  currentLineIdx: number,
  priorStretchAvail: number
): number {
  const isNotFirstLineAndNotFilled = currentLineIdx !== 0 && !lineData.isFilled;

  switch (alignment) {
    case ALIGNMENT_BEGIN:
      if (lastWrapAlignment !== LAST_WRAP_ALIGNMENT_INHERIT && isNotFirstLineAndNotFilled) {
        if (lastWrapAlignment === LAST_WRAP_ALIGNMENT_END) {
          return lineData.stretchAvail - priorStretchAvail;
        }
        if (lastWrapAlignment === LAST_WRAP_ALIGNMENT_CENTER) {
          return Math.trunc((lineData.stretchAvail - priorStretchAvail) * 0.5);
        }
      }
      return 0;
    case ALIGNMENT_CENTER:
      if (
        lastWrapAlignment !== LAST_WRAP_ALIGNMENT_INHERIT &&
        lastWrapAlignment !== LAST_WRAP_ALIGNMENT_CENTER &&
        isNotFirstLineAndNotFilled
      ) {
        return lastWrapAlignment === LAST_WRAP_ALIGNMENT_END
          ? Math.trunc(lineData.stretchAvail - priorStretchAvail * 0.5)
          : Math.trunc(priorStretchAvail * 0.5);
      }
      return Math.trunc(lineData.stretchAvail * 0.5);
    case ALIGNMENT_END:
      if (
        lastWrapAlignment !== LAST_WRAP_ALIGNMENT_INHERIT &&
        lastWrapAlignment !== LAST_WRAP_ALIGNMENT_END &&
        isNotFirstLineAndNotFilled
      ) {
        return lastWrapAlignment === LAST_WRAP_ALIGNMENT_BEGIN
          ? priorStretchAvail
          : Math.trunc(priorStretchAvail + (lineData.stretchAvail - priorStretchAvail) * 0.5);
      }
      return lineData.stretchAvail;
    default:
      return 0;
  }
}

/**
 * `FlowContainer::_resort` (`flow_container.cpp:45-265`): the wrap pass, then a
 * second pass that places each child: line alignment, cross-axis fill, `EXPAND`
 * share, `reverse_fill` and `fit_child_in_rect`. `contentRect` is the real rect on
 * both solve passes, so no size needs a stand-in.
 */
export const flowContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const vertical = orientationOf(n);
  const hSep = separationOf(n, 'h_separation', ctx.theme);
  const vSep = separationOf(n, 'v_separation', ctx.theme);
  const alignment = props(n).alignment ?? ALIGNMENT_BEGIN;
  const lastWrapAlignment = props(n).lastWrapAlignment ?? LAST_WRAP_ALIGNMENT_INHERIT;
  const reverseFill = props(n).reverseFill === true;
  const rtl = n.rtl;

  const sortable = children.filter(({ node }) => isSortableControl(node));
  const out = new Map<string, Rect2>();
  if (sortable.length === 0) return out;

  const currentContainerSize = Math.trunc(vertical ? contentRect.h : contentRect.w);
  const childMscs = buildChildMscs(sortable, vertical);
  const { lines } = computeLines(childMscs, vertical, hSep, vSep, currentContainerSize);

  let ofsX = 0;
  let ofsY = 0;
  let currentLineIdx = 0;
  let childIdxInLine = 0;

  sortable.forEach(({ node: child, minSize }, index) => {
    let lineData = lines[currentLineIdx]!;
    if (childIdxInLine >= lineData.childCount) {
      currentLineIdx++;
      childIdxInLine = 0;
      if (vertical) {
        ofsX += lineData.minLineHeight + hSep;
        ofsY = 0;
      } else {
        ofsX = 0;
        ofsY += lineData.minLineHeight + vSep;
      }
      lineData = lines[currentLineIdx]!;
    }

    if (childIdxInLine === 0 && isZeroApprox(lineData.stretchRatioTotal)) {
      const priorStretchAvail =
        currentLineIdx !== 0 && !lineData.isFilled ? lines[currentLineIdx - 1]!.stretchAvail : 0;
      const ofs = alignmentOffset(alignment, lastWrapAlignment, lineData, currentLineIdx, priorStretchAvail);
      if (vertical) ofsY += ofs;
      else ofsX += ofs;
    }

    const msc = childMscs[index]!.msc;
    let childW = msc.x;
    let childH = msc.y;

    // Not ported: the TextureRect "Fit" case (flow_container.cpp:207-222) reads the child's rect
    // from a previous frame. Godot calls it a "Temporary fix for editor crash" (flow_container.cpp:207-
    // 222).
    if (vertical) {
      const hFlags = hFlagsOf(child);
      if (hasFlag(hFlags, SIZE_FILL) || hasFlag(hFlags, SIZE_SHRINK_CENTER) || hasFlag(hFlags, SIZE_SHRINK_END)) {
        childW = lineData.minLineHeight;
      }
      if (hasFlag(vFlagsOf(child), SIZE_EXPAND) && !isZeroApprox(lineData.stretchRatioTotal)) {
        childH += Math.trunc((lineData.stretchAvail * childMscs[index]!.stretchRatio) / lineData.stretchRatioTotal);
      }
    } else {
      const vFlags = vFlagsOf(child);
      if (hasFlag(vFlags, SIZE_FILL) || hasFlag(vFlags, SIZE_SHRINK_CENTER) || hasFlag(vFlags, SIZE_SHRINK_END)) {
        childH = lineData.minLineHeight;
      }
      if (hasFlag(hFlagsOf(child), SIZE_EXPAND) && !isZeroApprox(lineData.stretchRatioTotal)) {
        childW += Math.trunc((lineData.stretchAvail * childMscs[index]!.stretchRatio) / lineData.stretchRatioTotal);
      }
    }

    let rectX = ofsX;
    let rectY = ofsY;
    // flow_container.cpp:245-250: `reverse_fill` flips the cross axis and `rtl` flips X. On a
    // vertical flow both land on X, and `(rtl != reverse_fill) && vertical` (flow_container.cpp:248) cancels them.
    if (reverseFill && !vertical) rectY = contentRect.h - ofsY - childH;
    if ((rtl && !vertical) || (rtl !== reverseFill && vertical)) rectX = contentRect.w - ofsX - childW;

    out.set(
      child.path,
      fitChildInRect({ x: rectX, y: rectY, w: childW, h: childH }, minSize, hFlagsOf(child), vFlagsOf(child), rtl)
    );

    if (vertical) ofsY += childH + vSep;
    else ofsX += childW + hSep;

    childIdxInLine++;
  });

  return out;
};

controlSolverRegistry.registerContainerLayout('FlowContainer', flowContainerLayout);
controlSolverRegistry.registerContainerLayout('HFlowContainer', flowContainerLayout);
controlSolverRegistry.registerContainerLayout('VFlowContainer', flowContainerLayout);
