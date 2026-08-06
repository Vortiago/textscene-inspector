/**
 * `gridContainerMinimumSize`/`gridContainerLayout` vs Godot 4.6.3
 * (`scene/gui/grid_container.cpp`, `scene/gui/container.cpp`,
 * `scene/gui/control.cpp`). Every expected rect below was cross-checked
 * against the real engine: a scratch project instantiated the equivalent
 * scene tree in a `SubViewport` and printed `Control.get_rect()` /
 * `get_combined_minimum_size()` per node (`s9-gridcontainer/probe-project`
 * in the packet report — scenarios a-i). Children are synthetic
 * `custom_minimum_size` Controls, never Labels, so a font-metric regression
 * and a `_resort` regression can never present as the same test failure.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { GridContainerProperties } from './types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, ContainerLayoutResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { gridContainerMinimumSize, gridContainerLayout } from './nativeSolver';
import { solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

/** `gridContainerLayout`'s `rects` half only — see `ContainerLayoutResult`'s own doc for why the union is here at all. */
function asMap(
  result: ReadonlyMap<string, Rect2> | ContainerLayoutResult
): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

function leaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
  };
}

function grid(name: string, props: Partial<GridContainerProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'GridContainer',
      children: [],
      properties: { name, ...props } as GridContainerProperties,
    },
    children,
  };
}

/** No registered per-type minimum size in these tests: only `custom_minimum_size` floors. */
function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: (n) => (n.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  };
}


/**
 * Solves `grid` and its children through the real solver core, so a test can
 * assert behaviour the core owns (`Control::set_rect`'s minimum re-floor and its
 * grow-direction shift) rather than a slice-local copy of it. The grid is given
 * explicit offsets so its own rect is exactly `rect`.
 */
function solveViaGrid(gridNode: SolveNode, rect: { x: number; y: number; w: number; h: number }) {
  const props = gridNode.node.properties as GridContainerProperties;
  (gridNode.node as { properties: unknown }).properties = {
    ...props,
    offsetLeft: rect.x,
    offsetTop: rect.y,
    offsetRight: rect.x + rect.w,
    offsetBottom: rect.y + rect.h,
  };
  // The slice self-registers on import, so nothing to wire here — and clearing
  // the registry would undo that.
  const solved = solveControlTree([gridNode], { x: 0, y: 0, w: 1152, h: 648 }, ctx());
  return new Map([...solved].map(([path, s]) => [path, s.rect]));
}

function childEntries(children: SolveNode[]): { node: SolveNode; minSize: { x: number; y: number } }[] {
  return children.map((node) => ({
    node,
    minSize: (node.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  }));
}

describe('gridContainerMinimumSize', () => {
  it('sums per-column max width + per-row max height + separation*(count-1) each axis — oracle: Grid min=[98,57]', () => {
    // scenario_a.tscn: columns=2, h_separation=8, v_separation=12.
    // col_minw = {0: max(30,40)=40, 1: max(50,20)=50} -> width 90+8*1=98
    // row_minh = {0: max(10,20)=20, 1: max(15,25)=25} -> height 45+12*1=57
    const a = leaf('A', { customMinimumSize: { x: 30, y: 10 } });
    const b = leaf('B', { customMinimumSize: { x: 50, y: 20 } });
    const c = leaf('C', { customMinimumSize: { x: 40, y: 15 } });
    const d = leaf('D', { customMinimumSize: { x: 20, y: 25 } });
    const n = grid(
      'Grid',
      { columns: 2, themeOverrideConstants: { h_separation: 8, v_separation: 12 } },
      [a, b, c, d]
    );
    expect(gridContainerMinimumSize(n, ctx())).toEqual({ x: 98, y: 57 });
  });

  it('truncates a fractional combined minimum size before folding into the column/row max (grid_container.cpp:290, Size2i cast)', () => {
    // scenario_h.tscn: both children truncate to width 10 (10.7 -> 10, 10.2 -> 10),
    // one column, two rows -> width=10 (not 10.7), height=trunc(5)+trunc(5)=10.
    const r0 = leaf('R0', { customMinimumSize: { x: 10.7, y: 5 } });
    const r1 = leaf('R1', { customMinimumSize: { x: 10.2, y: 5 } });
    const n = grid('Grid', { columns: 1, themeOverrideConstants: { h_separation: 0, v_separation: 0 } }, [
      r0,
      r1,
    ]);
    expect(gridContainerMinimumSize(n, ctx())).toEqual({ x: 10, y: 10 });
  });

  it('skips an invisible child, shifting the row/col count (grid_container.cpp:281-288, as_sortable_control VISIBLE) — oracle: Grid min=[55,12]', () => {
    // scenario_e.tscn: C1Hidden (visible=false) never claims a row/col slot,
    // so C2 lands in col 1 of row 0 alongside C0, not a phantom row 1.
    const c0 = leaf('C0', { customMinimumSize: { x: 20, y: 10 } });
    const hidden = leaf('C1Hidden', { customMinimumSize: { x: 999, y: 999 }, visible: false });
    const c2 = leaf('C2', { customMinimumSize: { x: 30, y: 12 } });
    const n = grid(
      'Grid',
      { columns: 2, themeOverrideConstants: { h_separation: 5, v_separation: 5 } },
      [c0, hidden, c2]
    );
    expect(gridContainerMinimumSize(n, ctx())).toEqual({ x: 55, y: 12 });
  });

  it('falls back to columns=1 for a missing/zero/negative `columns` property', () => {
    const only = leaf('Only', { customMinimumSize: { x: 12, y: 34 } });
    expect(gridContainerMinimumSize(grid('Grid', { columns: 0 }, [only]), ctx())).toEqual({ x: 12, y: 34 });
    expect(gridContainerMinimumSize(grid('Grid', {}, [only]), ctx())).toEqual({ x: 12, y: 34 });
  });

  it('is (0, 0) with no sortable children', () => {
    expect(gridContainerMinimumSize(grid('Grid', { columns: 3 }, []), ctx())).toEqual({ x: 0, y: 0 });
  });
});

describe('gridContainerLayout', () => {
  it('places a 2x2 grid — per-column max width, per-row max height, both separations (oracle: scenario_a.tscn)', () => {
    const a = leaf('A', { customMinimumSize: { x: 30, y: 10 } });
    const b = leaf('B', { customMinimumSize: { x: 50, y: 20 } });
    const c = leaf('C', { customMinimumSize: { x: 40, y: 15 } });
    const d = leaf('D', { customMinimumSize: { x: 20, y: 25 } });
    const children = [a, b, c, d];
    const n = grid(
      'Grid',
      { columns: 2, themeOverrideConstants: { h_separation: 8, v_separation: 12 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 400, h: 400 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    expect(rects.get('A')).toEqual({ x: 0, y: 0, w: 40, h: 20 });
    expect(rects.get('B')).toEqual({ x: 48, y: 0, w: 50, h: 20 });
    expect(rects.get('C')).toEqual({ x: 0, y: 32, w: 40, h: 25 });
    expect(rects.get('D')).toEqual({ x: 48, y: 32, w: 50, h: 25 });
  });

  it('distributes EXPAND width across two columns with a remainder pixel to the earliest one (oracle: scenario_b.tscn)', () => {
    // columns=3, h_separation=10, container width 300. C0 and C2 are EXPAND;
    // C1 (not expanded) reserves its own min (21). remaining=300-21-20=259,
    // 259/2=129 rem 1 -> col0 gets the +1 (col_remaining_pixel_index favours
    // the lowest column index first).
    const c0 = leaf('C0', { customMinimumSize: { x: 20, y: 10 }, sizeFlagsHorizontal: 3 });
    const c1 = leaf('C1', { customMinimumSize: { x: 21, y: 10 } });
    const c2 = leaf('C2', { customMinimumSize: { x: 20, y: 10 }, sizeFlagsHorizontal: 3 });
    const children = [c0, c1, c2];
    const n = grid(
      'Grid',
      { columns: 3, themeOverrideConstants: { h_separation: 10, v_separation: 10 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 300, h: 100 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    expect(rects.get('C0')).toEqual({ x: 0, y: 0, w: 130, h: 10 });
    expect(rects.get('C1')).toEqual({ x: 140, y: 0, w: 21, h: 10 });
    expect(rects.get('C2')).toEqual({ x: 171, y: 0, w: 129, h: 10 });
  });

  it('evicts the expanded column whose own minimum cannot fit an equal share, giving the rest to the survivor (oracle: scenario_c.tscn)', () => {
    // columns=2, both EXPAND, container width 300, h_separation=0. Equal share
    // 150 < C0's own min (200) -> C0 evicted, falls back to its own 200; C1
    // (the sole survivor) absorbs the rest: 300-200=100.
    const c0 = leaf('C0', { customMinimumSize: { x: 200, y: 10 }, sizeFlagsHorizontal: 3 });
    const c1 = leaf('C1', { customMinimumSize: { x: 20, y: 10 }, sizeFlagsHorizontal: 3 });
    const children = [c0, c1];
    const n = grid(
      'Grid',
      { columns: 2, themeOverrideConstants: { h_separation: 0, v_separation: 0 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 300, h: 100 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    expect(rects.get('C0')).toEqual({ x: 0, y: 0, w: 200, h: 10 });
    expect(rects.get('C1')).toEqual({ x: 200, y: 0, w: 100, h: 10 });
  });

  it('dilutes an EXPAND column by a phantom trailing column on an incomplete row (oracle: scenario_d.tscn)', () => {
    // columns=3 but only 2 children: "consider all empty columns expanded"
    // (grid_container.cpp:79-82) adds phantom col 2 to col_expanded even
    // though no child ever occupies it, so the ONE real expanded column (0)
    // shares the division with it and gets only HALF of the remaining space
    // (80, not the 160 it would get alone) — the other half is never rendered.
    const c0 = leaf('C0', { customMinimumSize: { x: 20, y: 15 }, sizeFlagsHorizontal: 3 });
    const c1 = leaf('C1', { customMinimumSize: { x: 30, y: 15 } });
    const children = [c0, c1];
    const n = grid(
      'Grid',
      { columns: 3, themeOverrideConstants: { h_separation: 10, v_separation: 10 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 200, h: 100 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    expect(rects.get('C0')).toEqual({ x: 0, y: 0, w: 80, h: 15 });
    expect(rects.get('C1')).toEqual({ x: 90, y: 0, w: 30, h: 15 });
  });

  it('omits an invisible child and shifts the next one into its row/col slot (oracle: scenario_e.tscn)', () => {
    const c0 = leaf('C0', { customMinimumSize: { x: 20, y: 10 } });
    const hidden = leaf('C1Hidden', { customMinimumSize: { x: 999, y: 999 }, visible: false });
    const c2 = leaf('C2', { customMinimumSize: { x: 30, y: 12 } });
    const children = [c0, hidden, c2];
    const n = grid(
      'Grid',
      { columns: 2, themeOverrideConstants: { h_separation: 5, v_separation: 5 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 300, h: 100 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    // Both land in row 0 (col 0 and col 1) since the hidden child claims no
    // slot; row height is the row-0 max (12, from C2), so C0 (FILL) stretches
    // to 12 too, not its own 10.
    expect(rects.get('C0')).toEqual({ x: 0, y: 0, w: 20, h: 12 });
    expect(rects.get('C2')).toEqual({ x: 25, y: 0, w: 30, h: 12 });
    expect(rects.has('C1Hidden')).toBe(false);
  });

  it('claws an EXPAND-without-FILL child back to its own minimum, pinned to the cell origin (oracle: scenario_f.tscn)', () => {
    // columns=1, R0 has SIZE_EXPAND only (no FILL) on the vertical axis: the
    // row still reserves the full expanded height (280 of a 300 px column),
    // but fit_child_in_rect claws R0's OWN rect back down to its 10px minimum
    // instead of filling the reservation.
    const r0 = leaf('R0', { customMinimumSize: { x: 50, y: 10 }, sizeFlagsVertical: 2 });
    const r1 = leaf('R1', { customMinimumSize: { x: 50, y: 20 } });
    const children = [r0, r1];
    const n = grid(
      'Grid',
      { columns: 1, themeOverrideConstants: { h_separation: 0, v_separation: 0 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 50, h: 300 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    expect(rects.get('R0')).toEqual({ x: 0, y: 0, w: 50, h: 10 });
    expect(rects.get('R1')).toEqual({ x: 0, y: 280, w: 50, h: 20 });
  });

  it('positions SHRINK_CENTER/SHRINK_END children inside a column sized by a wider FILL sibling (oracle: scenario_g.tscn)', () => {
    const r0 = leaf('R0Wide', { customMinimumSize: { x: 60, y: 10 } });
    const r1 = leaf('R1Center', { customMinimumSize: { x: 20, y: 10 }, sizeFlagsHorizontal: 4 });
    const r2 = leaf('R2End', { customMinimumSize: { x: 20, y: 10 }, sizeFlagsHorizontal: 8 });
    const children = [r0, r1, r2];
    const n = grid(
      'Grid',
      { columns: 1, themeOverrideConstants: { h_separation: 0, v_separation: 0 } },
      children
    );
    const contentRect = { x: 0, y: 0, w: 60, h: 300 };
    const rects = asMap(gridContainerLayout(n, childEntries(children), contentRect, ctx()));

    expect(rects.get('R0Wide')).toEqual({ x: 0, y: 0, w: 60, h: 10 });
    expect(rects.get('R1Center')).toEqual({ x: 20, y: 10, w: 20, h: 10 });
    expect(rects.get('R2End')).toEqual({ x: 40, y: 20, w: 20, h: 10 });
  });

  it(
    "re-floors a FILL child against its OWN untruncated minimum size after the container's truncated " +
      'column bookkeeping shrinks it (control.cpp:1773-1797, `Control::_size_changed` — a third file ' +
      "neither grid_container.cpp nor container.cpp calls out, but EVERY `Container::fit_child_in_rect` " +
      'ends in `Control::set_rect`, which re-derives and re-floors unconditionally) (oracle: scenario_h.tscn)',
    () => {
      // col_minw truncates both to 10, so the container hands each row a
      // 10px-wide cell — but each child's OWN combined minimum size (kept at
      // full precision, unlike the bookkeeping) is larger than that, so the
      // final rect grows past the cell to the child's own float minimum.
      const r0 = leaf('R0', { customMinimumSize: { x: 10.7, y: 5 } });
      const r1 = leaf('R1', { customMinimumSize: { x: 10.2, y: 5 } });
      const children = [r0, r1];
      const n = grid(
        'Grid',
        { columns: 1, themeOverrideConstants: { h_separation: 0, v_separation: 0 } },
        children
      );
      // Through `solveControlTree`, not `gridContainerLayout` alone: the floor
      // is `Control::set_rect`'s, so the solver core applies it to whatever any
      // container returns. Asserting it here would otherwise pass against a
      // second copy of the rule living in this slice.
      const solved = solveViaGrid(n, { x: 0, y: 0, w: 50, h: 50 });

      expect(solved.get('R0')).toEqual({ x: 0, y: 0, w: 10.7, h: 5 });
      expect(solved.get('R1')).toEqual({ x: 0, y: 5, w: 10.2, h: 5 });
    }
  );

  it('shifts position (not just size) when the re-floor fires under GROW_DIRECTION_BEGIN/BOTH (control.cpp:1776-1783) (oracle: scenario_i.tscn)', () => {
    const beginNode = leaf('R0Begin', { customMinimumSize: { x: 10.7, y: 5 }, growHorizontal: 0 });
    const bothNode = leaf('R1Both', { customMinimumSize: { x: 10.7, y: 5 }, growHorizontal: 2 });
    const children = [beginNode, bothNode];
    const n = grid(
      'Grid',
      { columns: 1, themeOverrideConstants: { h_separation: 0, v_separation: 0 } },
      children
    );
    const rects = solveViaGrid(n, { x: 0, y: 0, w: 50, h: 50 });

    // Cell width truncates to 10; shortfall = 10.7-10 = 0.7.
    // BEGIN: pos.x += (10 - 10.7) = -0.7. BOTH: pos.x += 0.5*(10-10.7) = -0.35.
    // Compared with `closeTo`, not `toEqual`: floating-point subtraction of
    // 10.7 (itself inexact in binary) makes the raw JS result
    // -0.6999999999999993, not the literal -0.7 — a precision artifact of the
    // SAME kind the engine's own float32 print showed (scenario_i.tscn:
    // rect=[-0.69999980926514,...]), not a bug in the port.
    const begin = rects.get('R0Begin')!;
    expect(begin.x).toBeCloseTo(-0.7, 9);
    expect(begin.y).toBe(0);
    expect(begin.w).toBeCloseTo(10.7, 9);
    expect(begin.h).toBe(5);

    const both = rects.get('R1Both')!;
    expect(both.x).toBeCloseTo(-0.35, 9);
    expect(both.y).toBe(5);
    expect(both.w).toBeCloseTo(10.7, 9);
    expect(both.h).toBe(5);
  });

  it('is empty with no sortable children', () => {
    const n = grid('Grid', { columns: 2 }, []);
    const rects = asMap(gridContainerLayout(n, [], { x: 0, y: 0, w: 100, h: 100 }, ctx()));
    expect(rects.size).toBe(0);
  });
});
