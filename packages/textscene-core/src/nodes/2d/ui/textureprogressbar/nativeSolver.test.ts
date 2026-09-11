/**
 * `textureProgressBarMinimumSize`/`normalizeTextureProgressBarFillMode` vs
 * Godot 4.6.3 (`texture_progress_bar.cpp:81-97,575-583`).
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { textureProgressBarMinimumSize, normalizeTextureProgressBarFillMode } from './nativeSolver';
import type { TextureProgressBarProperties } from './types';

function node(props: Partial<TextureProgressBarProperties>, internalResources: SolveNode['resources']['internalResources'] = []): SolveNode {
  const base = emptySolveNode();
  return {
    ...base,
    path: 'T',
    node: { name: 'T', type: 'TextureProgressBar', children: [], properties: { name: 'T', ...props } as TextureProgressBarProperties },
    resources: { ...base.resources, internalResources },
  };
}

describe('textureProgressBarMinimumSize (texture_progress_bar.cpp:81-97)', () => {
  it('nine_patch_stretch: sums the stretch margins per axis (:82-84)', () => {
    expect(
      textureProgressBarMinimumSize(
        node({ ninePatchStretch: true, stretchMarginLeft: 4, stretchMarginRight: 6, stretchMarginTop: 2, stretchMarginBottom: 3 }),
        { theme: undefined as never, combinedMinimumSize: () => ({ x: 0, y: 0 }), measureText: null }
      )
    ).toEqual({ x: 10, y: 5 });
  });

  it('no textures resolved, no nine_patch_stretch: floors to (1, 1) rather than (0, 0)', () => {
    expect(
      textureProgressBarMinimumSize(node({}), { theme: undefined as never, combinedMinimumSize: () => ({ x: 0, y: 0 }), measureText: null })
    ).toEqual({ x: 1, y: 1 });
  });

  it('maxes the three texture slots\' own sizes when inline-resolvable (a GradientTexture2D SubResource)', () => {
    const internalResources: SolveNode['resources']['internalResources'] = [
      { id: '1', type: 'GradientTexture2D', data: { width: '40', height: '12' } },
      { id: '2', type: 'GradientTexture2D', data: { width: '20', height: '30' } },
    ];
    expect(
      textureProgressBarMinimumSize(
        node({ textureUnder: 'SubResource("1")', textureOver: 'SubResource("2")' }, internalResources),
        { theme: undefined as never, combinedMinimumSize: () => ({ x: 0, y: 0 }), measureText: null }
      )
    ).toEqual({ x: 40, y: 30 });
  });
});

describe('normalizeTextureProgressBarFillMode (set_fill_mode, texture_progress_bar.cpp:575-583)', () => {
  it('passes an in-range mode through unchanged', () => {
    expect(normalizeTextureProgressBarFillMode(4)).toBe(4);
    expect(normalizeTextureProgressBarFillMode(8)).toBe(8);
  });

  it('an out-of-range mode normalizes to FILL_LEFT_TO_RIGHT (ERR_FAIL_INDEX refuses the write, :576)', () => {
    expect(normalizeTextureProgressBarFillMode(9)).toBe(0);
    expect(normalizeTextureProgressBarFillMode(-1)).toBe(0);
  });

  it('an absent fill_mode defaults to FILL_LEFT_TO_RIGHT (texture_progress_bar.h:105)', () => {
    expect(normalizeTextureProgressBarFillMode(undefined)).toBe(0);
  });
});
