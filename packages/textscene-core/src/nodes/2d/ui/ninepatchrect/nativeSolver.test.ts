/**
 * Tests `ninePatchRectMinimumSize` against Godot 4.6.3 (`scene/gui/nine_patch_rect.cpp:53-55`):
 * `Size2(margin[LEFT] + margin[RIGHT], margin[TOP] + margin[BOTTOM])`.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { NinePatchRectProperties } from './types';
import { ninePatchRectMinimumSize } from './nativeSolver';

const CTX: SolveContext = {
  theme: nativeTheme(1),
  measureText: null,
  combinedMinimumSize: () => ({ x: 0, y: 0 }),
};

function node(props: Partial<NinePatchRectProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'Panel',
    node: controlNode('Panel', 'NinePatchRect', { name: 'Panel', ...props }),
  };
}

describe('ninePatchRectMinimumSize', () => {
  it('sums the left+right and top+bottom patch margins', () => {
    const n = node({ patchMarginLeft: 4, patchMarginRight: 6, patchMarginTop: 5, patchMarginBottom: 7 });
    expect(ninePatchRectMinimumSize(n, CTX)).toEqual({ x: 10, y: 12 });
  });

  it('defaults every unset margin to 0 (the class default)', () => {
    const n = node({});
    expect(ninePatchRectMinimumSize(n, CTX)).toEqual({ x: 0, y: 0 });
  });

  it('does not gate on a texture — unlike TextureRect, the source runs unconditionally', () => {
    const n = { ...node({ patchMarginLeft: 3, patchMarginRight: 3 }), textureSize: null };
    expect(ninePatchRectMinimumSize(n, CTX)).toEqual({ x: 6, y: 0 });
  });
});
