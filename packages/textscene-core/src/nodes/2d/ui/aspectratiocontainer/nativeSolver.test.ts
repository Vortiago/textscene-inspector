/**
 * `aspectRatioContainerMinimumSize`/`aspectRatioContainerLayout` vs Godot
 * 4.6.3 (`scene/gui/aspect_ratio_container.cpp`, `scene/gui/container.cpp`).
 * Every expected rect below is hand-derived from that source (cited beside
 * each assertion). Children are synthetic `custom_minimum_size` Controls,
 * never Labels, so a font-metric regression and a layout regression can
 * never present as the same test failure.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { AspectRatioContainerProperties } from './types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, ContainerLayoutResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { aspectRatioContainerMinimumSize, aspectRatioContainerLayout } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

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

function textureRect(name: string, expandMode: number): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'TextureRect',
      children: [],
      properties: { name, expandMode } as unknown as ControlProperties,
    },
  };
}

function aspect(props: Partial<AspectRatioContainerProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: 'A',
    node: {
      name: 'A',
      type: 'AspectRatioContainer',
      children: [],
      properties: { name: 'A', ...props } as AspectRatioContainerProperties,
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

function childEntries(children: SolveNode[]): { node: SolveNode; minSize: { x: number; y: number } }[] {
  return children.map((node) => ({
    node,
    minSize: (node.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  }));
}

describe('aspectRatioContainerMinimumSize', () => {
  it('is the componentwise max of every visible child combined minimum size (aspect_ratio_container.cpp:35-46)', () => {
    const a = aspect({}, [
      leaf('c1', { customMinimumSize: { x: 30, y: 10 } }),
      leaf('c2', { customMinimumSize: { x: 10, y: 40 } }),
    ]);
    expect(aspectRatioContainerMinimumSize(a, ctx())).toEqual({ x: 30, y: 40 });
  });

  it('skips a hidden child (aspect_ratio_container.cpp:38, as_sortable_control VISIBLE)', () => {
    const hidden = leaf('c1', { customMinimumSize: { x: 90, y: 90 }, visible: false });
    const a = aspect({}, [hidden]);
    expect(aspectRatioContainerMinimumSize(a, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('is (0, 0) with no children', () => {
    expect(aspectRatioContainerMinimumSize(aspect({}, []), ctx())).toEqual({ x: 0, y: 0 });
  });
});

describe('aspectRatioContainerLayout', () => {
  it('STRETCH_FIT, ratio 1, square container: default-flag child fills it exactly (aspect_ratio_container.cpp:129-137)', () => {
    const child = leaf('c1');
    const a = aspect({}, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 100, h: 100 }, ctx())
    );
    expect(rects.get('c1')).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('STRETCH_WIDTH_CONTROLS_HEIGHT with ratio 2 derives height from width, centered vertically (aspect_ratio_container.cpp:123-125,163)', () => {
    const child = leaf('c1');
    const a = aspect({ stretchMode: 0, ratio: 2 }, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 100, h: 100 }, ctx())
    );
    // scale_factor = size.x / ratio = 100 / 2 = 50; child_size = (100, 50).
    expect(rects.get('c1')).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });

  it('ALIGNMENT_END/ALIGNMENT_BEGIN push the fit rect to the far horizontal edge, flush at the top (aspect_ratio_container.cpp:139-163)', () => {
    const child = leaf('c1');
    const a = aspect({ stretchMode: 2, ratio: 1, alignmentHorizontal: 2, alignmentVertical: 0 }, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 200, h: 100 }, ctx())
    );
    // STRETCH_FIT: scale_factor = min(200, 100) = 100 -> child_size (100, 100).
    // align_x = 1.0 (END): offset.x = (200 - 100) * 1 = 100. align_y = 0.0 (BEGIN): offset.y = 0.
    expect(rects.get('c1')).toEqual({ x: 100, y: 0, w: 100, h: 100 });
  });

  it('STRETCH_COVER can overflow the container, centered on the overflow (aspect_ratio_container.cpp:132-134)', () => {
    const child = leaf('c1');
    const a = aspect({ stretchMode: 3, ratio: 1 }, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 200, h: 100 }, ctx())
    );
    // scale_factor = max(200, 100) = 200 -> child_size (200, 200); offset.y = (100 - 200) * 0.5 = -50.
    expect(rects.get('c1')).toEqual({ x: 0, y: -50, w: 200, h: 200 });
  });

  it('floors the aspect-derived size to the child own combined minimum (aspect_ratio_container.cpp:136-137)', () => {
    const child = leaf('c1', { customMinimumSize: { x: 50, y: 20 } });
    const a = aspect({ stretchMode: 2, ratio: 1 }, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 10, h: 10 }, ctx())
    );
    // scale_factor = 10; child_size (10,10).max((50,20)) = (50, 20); offset = ((10-50)*.5, (10-20)*.5) = (-20, -5).
    expect(rects.get('c1')).toEqual({ x: -20, y: -5, w: 50, h: 20 });
  });

  it("a child without SIZE_FILL shrinks to its own minimum inside the aspect rect (container.cpp:103-108, fit_child_in_rect's shrink branch)", () => {
    const child = leaf('c1', { customMinimumSize: { x: 20, y: 20 }, sizeFlagsHorizontal: 0, sizeFlagsVertical: 0 });
    const a = aspect({ stretchMode: 2, ratio: 1 }, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 100, h: 100 }, ctx())
    );
    // Aspect rect is (0,0,100,100); no SIZE_FILL bit means fit_child_in_rect
    // shrinks each axis to the child's own minimum and does not offset (SHRINK_BEGIN).
    expect(rects.get('c1')).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it('an out-of-range stretch_mode leaves scale_factor at its initialized 1.0 (aspect_ratio_container.cpp:122-135 has no default case)', () => {
    const child = leaf('c1');
    const a = aspect({ stretchMode: 99, ratio: 2 }, [child]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([child]), { x: 0, y: 0, w: 100, h: 100 }, ctx())
    );
    // child_size (2, 1) never floored below custom_minimum_size (0,0); default
    // alignment CENTER: offset = ((100-2)*.5, (100-1)*.5) = (49, 49.5).
    expect(rects.get('c1')).toEqual({ x: 49, y: 49.5, w: 2, h: 1 });
  });

  it('skips a PROPORTIONAL-fit TextureRect entirely (aspect_ratio_container.cpp:109-116)', () => {
    const trect = textureRect('t1', 3); // EXPAND_FIT_WIDTH_PROPORTIONAL
    const a = aspect({}, [trect]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([trect]), { x: 0, y: 0, w: 100, h: 100 }, ctx())
    );
    expect(rects.has('t1')).toBe(false);
  });

  it('a plain (non-proportional) TextureRect still gets sized normally', () => {
    const trect = textureRect('t1', 2); // EXPAND_FIT_WIDTH
    const a = aspect({}, [trect]);
    const rects = asMap(
      aspectRatioContainerLayout(a, childEntries([trect]), { x: 0, y: 0, w: 100, h: 100 }, ctx())
    );
    expect(rects.has('t1')).toBe(true);
  });
});
