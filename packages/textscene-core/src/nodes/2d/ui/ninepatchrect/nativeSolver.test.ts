/**
 * `ninePatchRectMinimumSize` vs Godot 4.6.3
 * (`scene/gui/nine_patch_rect.cpp:53-55`):
 * `Size2(margin[LEFT] + margin[RIGHT], margin[TOP] + margin[BOTTOM])`.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { NinePatchRectProperties } from './types';
import { ninePatchRectMinimumSize, resolveNinePatchFilter } from './nativeSolver';

const CTX: SolveContext = {
  theme: nativeTheme(1),
  measureText: null,
  combinedMinimumSize: () => ({ x: 0, y: 0 }),
};

function node(props: Partial<NinePatchRectProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'Panel',
    node: { name: 'Panel', type: 'NinePatchRect', children: [], properties: { name: 'Panel', ...props } },
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

describe('resolveNinePatchFilter', () => {
  it('maps every NEAREST variant (1, 3, 5) to nearest', () => {
    expect(resolveNinePatchFilter(1)).toBe('nearest');
    expect(resolveNinePatchFilter(3)).toBe('nearest');
    expect(resolveNinePatchFilter(5)).toBe('nearest');
  });

  it('maps LINEAR (2) to linear', () => {
    expect(resolveNinePatchFilter(2)).toBe('linear');
  });

  it('an absent filter (PARENT_NODE) resolves to linear, the CanvasItem root default', () => {
    expect(resolveNinePatchFilter(undefined)).toBe('linear');
  });
});
