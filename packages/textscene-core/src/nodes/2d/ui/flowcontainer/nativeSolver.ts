/**
 * FlowContainer's native (WebGL canvas) rect solve — a port of
 * `FlowContainer::_resort`'s two passes and `FlowContainer::get_minimum_size`
 * (`scene/gui/flow_container.cpp`), plus the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) the
 * second pass calls per child.
 *
 * One solver, registered three times: `HFlowContainer`/`VFlowContainer` fix
 * `vertical` in their C++ constructors and hide the property
 * (`flow_container.h:99-113`), so `orientationOf` below resolves it from the
 * node's own type name for those two, falling back to the parsed `vertical`
 * property only for a plain `FlowContainer`.
 *
 * `get_minimum_size`'s cross-axis component is `cached_size`
 * (`flow_container.h:52`, member default `0`) — a value `_resort` last wrote
 * against WHATEVER `current_container_size` (this node's own main-axis size)
 * happened to be at that time. That is genuinely self-referential exactly
 * like `TextureRect`'s `EXPAND_FIT_WIDTH`/`FIT_HEIGHT`
 * (`texturerect/nativeSolver.ts`'s own doc) — this solver's minimum-size pass
 * runs bottom-up, before any rect is assigned, so "this node's own current
 * main-axis size" does not exist on a tree's first pass. Closed the same way:
 * `HFlowContainer`/`VFlowContainer`/`FlowContainer` are all registered via
 * `controlSolverRegistry.registerSizeDependentMinimum` (below, alongside the
 * minimum-size registration itself), so `solveControlTree` runs a bounded second pass feeding
 * `SolveContext.tentativeRect`'s main-axis dimension back in here. On the
 * FIRST pass (`tentativeRect` undefined) `current_container_size` substitutes
 * `Infinity` — never wrap, matching the least-circular estimate available
 * (mirroring `textureRectMinimumSize`'s own substitution, which uses the
 * texture's own natural size for the same reason) — rather than Godot's
 * literal pre-resort `0`, which would floor this container to a degenerate
 * rect on the very first pass instead of converging to the correct wrapped
 * size on the second.
 *
 * The `ContainerLayoutFn` needs no such substitution: `contentRect` is
 * already this node's REAL resolved rect on both passes (Phase 2 runs after
 * Phase 1 in each pass), so `_resort`'s own `get_size()` reads translate
 * directly.
 *
 * Integer truncation matters throughout `_resort`: `current_container_size`,
 * every child's cached combined minimum size, `ofs`, `line_height`,
 * `line_length`, `alignment_ofs` and the EXPAND `stretch` amount are all
 * `int`/`Size2i`/`Vector2i` in the source, so a float intermediate (an
 * alignment split, a stretch-ratio division) is truncated TOWARD ZERO before
 * use — `Math.trunc`, never `Math.floor` (`stretch_avail` goes negative on an
 * overflowing line, where the two diverge). AspectRatioContainer, by
 * contrast, is all-float `Size2` with no truncation anywhere — do not carry
 * this pattern there.
 *
 * The multiline `TextureRect` "Fit" special case (`flow_container.cpp:207-
 * 222`, itself a documented "Temporary fix for editor crash") reads the
 * child's OWN PRE-EXISTING rect from a previous frame — genuinely
 * unavailable to a deterministic single solve — and is deliberately not
 * ported; such a child is sized like any other.
 *
 * RTL (`is_layout_rtl()`) out of scope, matching every other container in
 * this codebase (`native/controlRectSolver.ts`'s own note) — `reverse_fill`
 * below is ported with `rtl` hardcoded `false`, which is why it flips the
 * CROSS axis (not main) when `vertical`: `(rtl != reverse_fill) && vertical`
 * reduces to `reverse_fill && vertical` once `rtl` is always `false`.
 *
 * Pure data + functions, no React, no THREE.
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

// Control's own stretch-ratio default (control.cpp:1868-1878, "1.0").
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

/** `HFlowContainer`/`VFlowContainer` fix `vertical` in their C++ constructor; see module doc. */
function orientationOf(n: SolveNode): boolean {
  if (n.node.type === 'HFlowContainer') return false;
  if (n.node.type === 'VFlowContainer') return true;
  return props(n).vertical === true;
}

function separationOf(n: SolveNode, key: 'h_separation' | 'v_separation', theme: NativeTheme): number {
  return n.constants[key] ?? theme.separation;
}

// --- The shared line-wrap pass (flow_container.cpp:65-129) -------------------

interface ChildMsc {
  /** Combined minimum size, truncated to `Size2i` (`:72`). */
  msc: Vec2;
  /** Whether this child's size flag on the MAIN axis (`v`/`h_size_flags`) has `SIZE_EXPAND`. */
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
 * `FlowContainer::_resort`'s first pass (`flow_container.cpp:65-129`): builds
 * one `LineData` per wrapped line/column and returns `cached_size`
 * (`:262`). Shared by the minimum-size function (which needs only
 * `cachedSize`) and the layout function (which needs the full `lines` array
 * for its second pass).
 *
 * The wrap check (`ofs + child_msc > current_container_size`) runs even when
 * `children_in_current_line === 0` — so a FIRST child alone wider than
 * `current_container_size` still pushes an initial EMPTY line (count 0,
 * height 0, length `-separation`) before its own line starts; only the very
 * first child can trigger this (every later over-wide child instead lands
 * alone in whatever line it starts). Transcribed as-is: guarding the wrap on
 * a non-empty line would silently diverge from Godot here.
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

// --- get_minimum_size ---------------------------------------------------------

/**
 * `FlowContainer::get_minimum_size` (`flow_container.cpp:267-289`): the
 * MAIN-axis component is the plain max of every visible child's own combined
 * minimum size on that axis (no wrap dependency at all); the CROSS-axis
 * component is `cached_size` (see module doc for the two-pass closure). Both
 * are `(0, 0)` with no sortable children — the loop that would assign either
 * never runs.
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

// --- _resort's second pass ----------------------------------------------------

/**
 * The per-line alignment offset applied to the FIRST child of a line whose
 * `stretch_ratio_total` is zero-approx (`flow_container.cpp:159-205`) — a
 * line with an expanding child fills the whole main axis, making alignment
 * moot. `last_wrap_alignment` only ever applies to the trailing line, since
 * every OTHER line's `is_filled` is hardcoded `true` when it is pushed
 * (`computeLines` above) — only the final line's `is_filled` is computed.
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
 * `FlowContainer::_resort` (`flow_container.cpp:45-265`): the shared wrap
 * pass above, then a second pass walking every child in the SAME order to
 * assign its rect — advancing to the next line, applying that line's
 * alignment offset to its first child, stretching a cross-axis-filled child
 * to the line's own thickness, stretching an `EXPAND` child's main-axis size
 * by its proportional share of the line's leftover space, and finally
 * `reverse_fill` + `fit_child_in_rect`.
 */
export const flowContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const vertical = orientationOf(n);
  const hSep = separationOf(n, 'h_separation', ctx.theme);
  const vSep = separationOf(n, 'v_separation', ctx.theme);
  const alignment = props(n).alignment ?? ALIGNMENT_BEGIN;
  const lastWrapAlignment = props(n).lastWrapAlignment ?? LAST_WRAP_ALIGNMENT_INHERIT;
  const reverseFill = props(n).reverseFill === true;

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

    // flow_container.cpp:207-222's multiline TextureRect "Fit" special case
    // deliberately not ported — see module doc.
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
    // rtl hardcoded false (module doc): reverse_fill flips the CROSS axis —
    // Y when horizontal, X when vertical.
    if (reverseFill && !vertical) rectY = contentRect.h - ofsY - childH;
    if (reverseFill && vertical) rectX = contentRect.w - ofsX - childW;

    out.set(
      child.path,
      fitChildInRect({ x: rectX, y: rectY, w: childW, h: childH }, minSize, hFlagsOf(child), vFlagsOf(child))
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
