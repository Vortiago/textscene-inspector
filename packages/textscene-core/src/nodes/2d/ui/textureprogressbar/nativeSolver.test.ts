/**
 * `textureProgressBarMinimumSize`/`normalizeTextureProgressBarFillMode` against
 * Godot 4.6.3 (`texture_progress_bar.cpp:81-97,575-583`).
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import {
  textureProgressBarMinimumSize,
  textureProgressBarTextureSlots,
  normalizeTextureProgressBarFillMode,
  TEXTURE_UNDER_KEY,
  TEXTURE_PROGRESS_KEY,
  TEXTURE_OVER_KEY,
} from './nativeSolver';
import type { TextureProgressBarProperties } from './types';

function node(props: Partial<TextureProgressBarProperties>, textureSlots: SolveNode['textureSlots'] = {}): SolveNode {
  const base = emptySolveNode();
  return {
    ...base,
    path: 'T',
    node: { name: 'T', type: 'TextureProgressBar', children: [], properties: { name: 'T', ...props } as TextureProgressBarProperties },
    textureSlots,
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

  it('maxes the three resolved texture slots\' own sizes (:86-96)', () => {
    const n = node(
      { textureUnder: 'SubResource("1")', textureOver: 'SubResource("2")' },
      { [TEXTURE_UNDER_KEY]: { x: 40, y: 12 }, [TEXTURE_OVER_KEY]: { x: 20, y: 30 } }
    );
    expect(
      textureProgressBarMinimumSize(n, { theme: undefined as never, combinedMinimumSize: () => ({ x: 0, y: 0 }), measureText: null })
    ).toEqual({ x: 40, y: 30 });
  });

  it('a slot authored but not yet resolved (null) does not contribute, and still floors to (1, 1)', () => {
    const n = node({ textureProgress: 'ExtResource("1")' }, { [TEXTURE_PROGRESS_KEY]: null });
    expect(
      textureProgressBarMinimumSize(n, { theme: undefined as never, combinedMinimumSize: () => ({ x: 0, y: 0 }), measureText: null })
    ).toEqual({ x: 1, y: 1 });
  });
});

describe('textureProgressBarTextureSlots (texture_progress_bar.h:38-40)', () => {
  it('requests every authored slot, keyed by its own Godot property name', () => {
    const n = node({
      textureUnder: 'ExtResource("1")',
      textureProgress: 'ExtResource("2")',
      textureOver: 'ExtResource("3")',
    });
    expect(textureProgressBarTextureSlots(n.node)).toEqual([
      { key: TEXTURE_UNDER_KEY, ref: 'ExtResource("1")' },
      { key: TEXTURE_PROGRESS_KEY, ref: 'ExtResource("2")' },
      { key: TEXTURE_OVER_KEY, ref: 'ExtResource("3")' },
    ]);
  });

  it('requests nothing for a node with no texture slots authored', () => {
    const n = node({});
    expect(textureProgressBarTextureSlots(n.node)).toEqual([]);
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
