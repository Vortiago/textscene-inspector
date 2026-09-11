/**
 * `texturebutton/nativeSolver.ts` vs Godot 4.6.3 (`scene/gui/texture_button.cpp`).
 * Expected numbers are hand-derived from the source, not recomputed the way
 * the implementation itself computes them.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { TextureButtonProperties } from './types';
import {
  resolveTextureButtonDrawState,
  resolveTextureButtonSlot,
  textureButtonMinimumSize,
  textureButtonDraw,
  textureButtonTextureSlots,
  TEXTURE_NORMAL_KEY,
  TEXTURE_PRESSED_KEY,
  TEXTURE_HOVER_KEY,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function ctx(): SolveContext {
  return { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
}

function node(
  props: Partial<TextureButtonProperties>,
  textureSlots: SolveNode['textureSlots'] = {}
): SolveNode {
  return {
    ...solveNode(),
    path: 'TB',
    textureSlots,
    node: {
      name: 'TB',
      type: 'TextureButton',
      children: [],
      properties: { name: 'TB', ...props } as TextureButtonProperties,
    },
  };
}

describe('resolveTextureButtonDrawState', () => {
  it('is "normal" when neither pressed nor disabled', () => {
    expect(resolveTextureButtonDrawState({} as TextureButtonProperties)).toBe('normal');
  });

  it('is "pressed" when button_pressed is true and not disabled', () => {
    expect(resolveTextureButtonDrawState({ buttonPressed: true } as TextureButtonProperties)).toBe('pressed');
  });

  it('is "disabled" when disabled is true, even if also pressed', () => {
    expect(
      resolveTextureButtonDrawState({ buttonPressed: true, disabled: true } as TextureButtonProperties)
    ).toBe('disabled');
  });
});

describe('resolveTextureButtonSlot (texture_button.cpp:120-159)', () => {
  it('normal state always resolves to textureNormal (no further fallback)', () => {
    expect(resolveTextureButtonSlot({} as TextureButtonProperties, 'normal')).toBe('textureNormal');
  });

  it('pressed state prefers texture_pressed when set', () => {
    const props = { texturePressed: 'ref' } as TextureButtonProperties;
    expect(resolveTextureButtonSlot(props, 'pressed')).toBe('texturePressed');
  });

  it('pressed state falls back to texture_hover when texture_pressed is unset', () => {
    const props = { textureHover: 'ref' } as TextureButtonProperties;
    expect(resolveTextureButtonSlot(props, 'pressed')).toBe('textureHover');
  });

  it('pressed state falls all the way back to texture_normal when neither pressed nor hover is set', () => {
    expect(resolveTextureButtonSlot({} as TextureButtonProperties, 'pressed')).toBe('textureNormal');
  });

  it('disabled state prefers texture_disabled when set', () => {
    const props = { textureDisabled: 'ref' } as TextureButtonProperties;
    expect(resolveTextureButtonSlot(props, 'disabled')).toBe('textureDisabled');
  });

  it('disabled state falls back to texture_normal when texture_disabled is unset', () => {
    expect(resolveTextureButtonSlot({} as TextureButtonProperties, 'disabled')).toBe('textureNormal');
  });
});

describe('textureButtonMinimumSize (texture_button.cpp:31-52)', () => {
  it('is (0, 0) when ignore_texture_size is true, even with a resolved texture_normal size', () => {
    const n = node({ ignoreTextureSize: true }, { [TEXTURE_NORMAL_KEY]: { x: 64, y: 24 } });
    expect(textureButtonMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('is (0, 0) when no texture slot has resolved yet', () => {
    const n = node({});
    expect(textureButtonMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('is texture_normal\'s own size when present (:35-36)', () => {
    const n = node({}, { [TEXTURE_NORMAL_KEY]: { x: 64, y: 24 } });
    expect(textureButtonMinimumSize(n, ctx())).toEqual({ x: 64, y: 24 });
  });

  it('falls back to texture_pressed when texture_normal is unresolved (:37-45, is_null())', () => {
    const n = node({}, { [TEXTURE_NORMAL_KEY]: null, [TEXTURE_PRESSED_KEY]: { x: 48, y: 18 } });
    expect(textureButtonMinimumSize(n, ctx())).toEqual({ x: 48, y: 18 });
  });

  it('falls back to texture_hover when neither texture_normal nor texture_pressed has resolved (:38-42)', () => {
    const n = node({}, { [TEXTURE_NORMAL_KEY]: null, [TEXTURE_PRESSED_KEY]: null, [TEXTURE_HOVER_KEY]: { x: 30, y: 12 } });
    expect(textureButtonMinimumSize(n, ctx())).toEqual({ x: 30, y: 12 });
  });

  it('abs()es a negative resolved size (`rscale.abs()`, :51)', () => {
    const n = node({}, { [TEXTURE_NORMAL_KEY]: { x: -64, y: -24 } });
    expect(textureButtonMinimumSize(n, ctx())).toEqual({ x: 64, y: 24 });
  });
});

describe('textureButtonTextureSlots (texture_button.cpp:38-55)', () => {
  it('requests only the AUTHORED slots, in normal/pressed/hover cascade order', () => {
    const n = node({ texturePressed: 'ExtResource("2")', textureHover: 'ExtResource("3")' });
    expect(textureButtonTextureSlots(n.node)).toEqual([
      { key: TEXTURE_PRESSED_KEY, ref: 'ExtResource("2")' },
      { key: TEXTURE_HOVER_KEY, ref: 'ExtResource("3")' },
    ]);
  });

  it('requests nothing for a node with none of the three set', () => {
    const n = node({});
    expect(textureButtonTextureSlots(n.node)).toEqual([]);
  });

  it('never requests texture_disabled/texture_focused/texture_click_mask — none affects get_minimum_size', () => {
    const n = node({
      textureDisabled: 'ExtResource("4")',
      textureFocused: 'ExtResource("5")',
    } as Partial<TextureButtonProperties>);
    expect(textureButtonTextureSlots(n.node)).toEqual([]);
  });
});

describe('textureButtonDraw — degenerate texture size', () => {
  it('returns a zero draw for a non-positive texture size', () => {
    expect(textureButtonDraw({ x: 50, y: 50 }, { x: 0, y: 0 }, 0)).toEqual({
      offset: { x: 0, y: 0 },
      size: { x: 0, y: 0 },
      region: undefined,
      tile: false,
    });
  });
});

describe('textureButtonDraw — STRETCH_SCALE (0)', () => {
  it('fills the control rect, no region, no tile', () => {
    const draw = textureButtonDraw({ x: 50, y: 30 }, { x: 64, y: 24 }, 0);
    expect(draw).toEqual({ offset: { x: 0, y: 0 }, size: { x: 50, y: 30 }, region: undefined, tile: false });
  });
});

describe('textureButtonDraw — STRETCH_TILE (1)', () => {
  it('fills the control rect with tile: true', () => {
    const draw = textureButtonDraw({ x: 50, y: 30 }, { x: 64, y: 24 }, 1);
    expect(draw.size).toEqual({ x: 50, y: 30 });
    expect(draw.tile).toBe(true);
  });
});

describe('textureButtonDraw — STRETCH_KEEP (2, the Godot default)', () => {
  it('draws at natural texture size, offset 0', () => {
    const draw = textureButtonDraw({ x: 50, y: 30 }, { x: 64, y: 24 }, 2);
    expect(draw).toEqual({ offset: { x: 0, y: 0 }, size: { x: 64, y: 24 }, region: undefined, tile: false });
  });

  it('applies the same math when stretch_mode is undefined (STRETCH_KEEP is the class default)', () => {
    const draw = textureButtonDraw({ x: 50, y: 30 }, { x: 64, y: 24 }, undefined);
    expect(draw.size).toEqual({ x: 64, y: 24 });
  });
});

describe('textureButtonDraw — STRETCH_KEEP_CENTERED (3)', () => {
  it('centres the natural-size texture within the control rect', () => {
    const draw = textureButtonDraw({ x: 100, y: 50 }, { x: 64, y: 24 }, 3);
    expect(draw.offset).toEqual({ x: 18, y: 13 });
    expect(draw.size).toEqual({ x: 64, y: 24 });
  });
});

describe('textureButtonDraw — STRETCH_KEEP_ASPECT (4) / STRETCH_KEEP_ASPECT_CENTERED (5): pure float, no truncation', () => {
  it('does NOT truncate — texture_button.cpp:206-219 is float, unlike texture_rect.cpp:63-69', () => {
    // textureSize (30,20), rectSize (50,50): texWidth = 30*50/20 = 75 > 50,
    // so texWidth=50, texHeight = 20*50/30 = 33.333... (not 33).
    const draw = textureButtonDraw({ x: 50, y: 50 }, { x: 30, y: 20 }, 4);
    expect(draw.size.x).toBe(50);
    expect(draw.size.y).toBeCloseTo(33.3333333, 5);
  });

  it('STRETCH_KEEP_ASPECT (4) does not centre — offset stays (0, 0)', () => {
    const draw = textureButtonDraw({ x: 50, y: 50 }, { x: 30, y: 20 }, 4);
    expect(draw.offset).toEqual({ x: 0, y: 0 });
  });

  it('STRETCH_KEEP_ASPECT_CENTERED (5) centres the fitted rect', () => {
    const draw = textureButtonDraw({ x: 50, y: 50 }, { x: 30, y: 20 }, 5);
    // offset.x = (50-50)/2 = 0; offset.y = (50-33.333...)/2 = 8.333...
    expect(draw.offset.x).toBe(0);
    expect(draw.offset.y).toBeCloseTo(8.3333333, 5);
  });
});

describe('textureButtonDraw — STRETCH_KEEP_ASPECT_COVERED (6)', () => {
  it('fills the control rect and crops a texture-pixel-space region', () => {
    // textureSize (100,50), rectSize (60,60): scaleX=0.6, scaleY=1.2, scale=1.2.
    // scaledTexW=120, scaledTexH=60. region.x=abs((120-60)/1.2)/2=25, region.y=0.
    // region.w=60/1.2=50, region.h=60/1.2=50.
    const draw = textureButtonDraw({ x: 60, y: 60 }, { x: 100, y: 50 }, 6);
    expect(draw.size).toEqual({ x: 60, y: 60 });
    expect(draw.offset).toEqual({ x: 0, y: 0 });
    expect(draw.region).toEqual({ x: 25, y: 0, w: 50, h: 50 });
  });
});
