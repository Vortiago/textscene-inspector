/**
 * `textureRectMinimumSize` / `textureRectDraw` vs Godot 4.6.3
 * (`scene/gui/texture_rect.cpp`). A single non-square texture (320×160, the
 * same fixture size `Component.fit.test.ts` already uses) runs through every
 * `expand_mode` and `stretch_mode`, so a driver-axis or offset regression in
 * one mode can never hide behind a square texture's symmetry.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
// Side-effect import: registers every Control slice's solver, including this
// type's own `registerSizeDependentMinimum` (`index.r3f.ts`) — needed for the
// end-to-end `solveControlTree` describe below to actually exercise the real
// second pass, not a hand-rolled stand-in for it.
import '../../../../r3f/controls/index';
import type { TextureRectProperties } from './types';
import {
  textureRectMinimumSize,
  textureRectDraw,
  resolveTextureRectFilter,
  resolveTextureRectRepeat,
  applyFlip,
} from './nativeSolver';

const TEXTURE = { x: 320, y: 160 };

/** `textureRectMinimumSize`'s `size` half only — see `MinimumSizeResult`'s own doc for why the union is here at all. */
function size(result: Vec2 | MinimumSizeResult): Vec2 {
  return 'x' in result ? result : result.size;
}

function node(props: Partial<TextureRectProperties>, textureSize: { x: number; y: number } | null): SolveNode {
  return {
    path: 'Portrait',
    node: {
      name: 'Portrait',
      type: 'TextureRect',
      children: [],
      properties: { name: 'Portrait', ...props } as ControlProperties,
    },
    children: [],
    styleBoxes: {},
    textureSize,
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('textureRectMinimumSize (texture_rect.cpp:107-133)', () => {
  it('is the texture size for EXPAND_KEEP_SIZE (0), the Godot default (:110-112)', () => {
    expect(textureRectMinimumSize(node({}, TEXTURE), ctx())).toEqual({ x: 320, y: 160 });
    expect(textureRectMinimumSize(node({ expandMode: 0 }, TEXTURE), ctx())).toEqual({ x: 320, y: 160 });
  });

  it('is (0, 0) for EXPAND_IGNORE_SIZE (1) (:113-115)', () => {
    expect(textureRectMinimumSize(node({ expandMode: 1 }, TEXTURE), ctx())).toEqual({ x: 0, y: 0 });
  });

  it(
    'FIT_WIDTH (2) names WIDTH as the driven axis — height stays 0 (:116-118)',
    () => {
      expect(textureRectMinimumSize(node({ expandMode: 2 }, TEXTURE), ctx())).toEqual({ x: 160, y: 0 });
    }
  );

  it('FIT_HEIGHT (4) names HEIGHT as the driven axis — width stays 0 (:123-125)', () => {
    expect(textureRectMinimumSize(node({ expandMode: 4 }, TEXTURE), ctx())).toEqual({ x: 0, y: 320 });
  });

  it(
    "FIT_WIDTH and FIT_HEIGHT disagree on which axis is 0 (the driver-axis divergence " +
      "comparison.md documents against DOM's symmetric `aspect-ratio: 1/1` for both)",
    () => {
      const fitWidth = size(textureRectMinimumSize(node({ expandMode: 2 }, TEXTURE), ctx()));
      const fitHeight = size(textureRectMinimumSize(node({ expandMode: 4 }, TEXTURE), ctx()));
      expect(fitWidth).not.toEqual(fitHeight);
      expect(fitWidth.y).toBe(0);
      expect(fitHeight.x).toBe(0);
    }
  );

  it('FIT_WIDTH_PROPORTIONAL (3) collapses to the texture\'s own width on the driven axis (:119-122)', () => {
    // Size2(get_size().y * (tex.w/tex.h), 0); substituting textureSize.y for
    // the unavailable get_size().y: 160 * (320/160) = 320 = textureSize.x.
    expect(textureRectMinimumSize(node({ expandMode: 3 }, TEXTURE), ctx())).toEqual({ x: 320, y: 0 });
  });

  it("FIT_HEIGHT_PROPORTIONAL (5) collapses to the texture's own height on the driven axis (:126-129)", () => {
    // Size2(0, get_size().x * (tex.h/tex.w)); substituting textureSize.x:
    // 320 * (160/320) = 160 = textureSize.y.
    expect(textureRectMinimumSize(node({ expandMode: 5 }, TEXTURE), ctx())).toEqual({ x: 0, y: 160 });
  });

  it('contributes nothing before the texture has resolved (SolveNode.textureSize === null)', () => {
    expect(textureRectMinimumSize(node({ expandMode: 0 }, null), ctx())).toEqual({ x: 0, y: 0 });
    expect(textureRectMinimumSize(node({ expandMode: 3 }, null), ctx())).toEqual({ x: 0, y: 0 });
  });
});

describe('textureRectMinimumSize — SolveContext.tentativeRect closes the self-reference (texture_rect.cpp:116-129)', () => {
  function ctxWithTentative(rect: { x: number; y: number; w: number; h: number }): SolveContext {
    return { ...ctx(), tentativeRect: () => rect };
  }

  it('FIT_WIDTH (2) reads get_size().y from the tentative rect\'s OWN height, not the texture\'s (:116-118)', () => {
    // Godot: Size2(get_size().y, 0). The tentative rect's height (500) is
    // NOT the texture's own height (160) — proves the real value wins.
    const result = textureRectMinimumSize(node({ expandMode: 2 }, TEXTURE), ctxWithTentative({ x: 0, y: 0, w: 10, h: 500 }));
    expect(result).toEqual({ x: 500, y: 0 });
  });

  it("FIT_HEIGHT (4) reads get_size().x from the tentative rect's OWN width, not the texture's (:123-125)", () => {
    const result = textureRectMinimumSize(node({ expandMode: 4 }, TEXTURE), ctxWithTentative({ x: 0, y: 0, w: 500, h: 10 }));
    expect(result).toEqual({ x: 0, y: 500 });
  });

  it('FIT_WIDTH_PROPORTIONAL (3) scales the tentative height by the texture\'s own aspect ratio (:119-122)', () => {
    // ratio = tex.w/tex.h = 320/160 = 2; Size2(get_size().y * ratio, 0).
    const result = textureRectMinimumSize(
      node({ expandMode: 3 }, TEXTURE),
      ctxWithTentative({ x: 0, y: 0, w: 10, h: 50 })
    );
    expect(result).toEqual({ x: 100, y: 0 });
  });

  it("FIT_HEIGHT_PROPORTIONAL (5) scales the tentative width by the texture's own aspect ratio (:126-129)", () => {
    // ratio = tex.h/tex.w = 160/320 = 0.5; Size2(0, get_size().x * ratio).
    const result = textureRectMinimumSize(
      node({ expandMode: 5 }, TEXTURE),
      ctxWithTentative({ x: 0, y: 0, w: 50, h: 10 })
    );
    expect(result).toEqual({ x: 0, y: 25 });
  });

  it('EXPAND_KEEP_SIZE (0) and EXPAND_IGNORE_SIZE (1) never consult the tentative rect at all', () => {
    const withTentative = ctxWithTentative({ x: 0, y: 0, w: 999, h: 999 });
    expect(textureRectMinimumSize(node({ expandMode: 0 }, TEXTURE), withTentative)).toEqual({ x: 320, y: 160 });
    expect(textureRectMinimumSize(node({ expandMode: 1 }, TEXTURE), withTentative)).toEqual({ x: 0, y: 0 });
  });

  it('an absent tentativeRect() reading (undefined) falls back to the texture\'s own size, exactly like a ctx with no tentativeRect at all', () => {
    const ctxUndefinedTentative: SolveContext = { ...ctx(), tentativeRect: () => undefined };
    const withField = textureRectMinimumSize(node({ expandMode: 2 }, TEXTURE), ctxUndefinedTentative);
    const withoutField = textureRectMinimumSize(node({ expandMode: 2 }, TEXTURE), ctx());
    expect(withField).toEqual(withoutField);
    expect(withField).toEqual({ x: 160, y: 0 });
  });
});

describe('solveControlTree — the real two-pass solve closes the self-reference end-to-end', () => {
  const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };

  it('registers TextureRect as size-dependent, so a lone TextureRect tree still needs no second pass to see the SAME number', () => {
    // Zero-width anchors (raw w=0) + a real fixed height (500, via anchorBottom)
    // — first pass floors width from the TEXTURE's own height (160), second
    // pass re-floors it from the REAL resolved height (500) instead.
    const root = node({ expandMode: 2, anchorBottom: 1, offsetBottom: -148 }, TEXTURE);
    const solved = solveControlTree([root], VIEWPORT, createSolveContext(nativeTheme(1)));

    // FIT_WIDTH: minSize.x = get_size().y. The tree's only non-driven-axis
    // truth is the anchored height (500), not the texture's own (160) —
    // proves the second pass's `tentativeRect` fed the REAL value in, not
    // the first pass's texture-size substitute.
    expect(solved.get('Portrait')?.rect).toEqual({ x: 0, y: 0, w: 500, h: 500 });
  });

  it('a tree with no TextureRect at all is unaffected (single pass, unchanged rects)', () => {
    const plain: SolveNode = {
      path: 'Plain',
      node: { name: 'Plain', type: 'Control', children: [], properties: { name: 'Plain', anchorRight: 1, anchorBottom: 1 } as ControlProperties },
      children: [],
      styleBoxes: {},
      textureSize: null,
    };
    const solved = solveControlTree([plain], VIEWPORT, createSolveContext(nativeTheme(1)));
    expect(solved.get('Plain')?.rect).toEqual(VIEWPORT);
  });
});

describe('textureRectDraw (texture_rect.cpp:33-100, NOTIFICATION_DRAW)', () => {
  const RECT = { x: 300, y: 100 }; // 3:1 — deliberately NOT the texture's own 2:1 aspect.

  it('STRETCH_SCALE (0): the full control rect, no crop, no tile (:46-48)', () => {
    expect(textureRectDraw(RECT, TEXTURE, 0)).toEqual({
      offset: { x: 0, y: 0 },
      size: { x: 300, y: 100 },
      region: undefined,
      tile: false,
    });
  });

  it('undefined stretch_mode defaults to SCALE (Godot default `stretch_mode = STRETCH_SCALE`, texture_rect.h:63)', () => {
    expect(textureRectDraw(RECT, TEXTURE, undefined)).toEqual(textureRectDraw(RECT, TEXTURE, 0));
  });

  it('STRETCH_TILE (1): the full control rect, tile=true (:49-52)', () => {
    expect(textureRectDraw(RECT, TEXTURE, 1)).toEqual({
      offset: { x: 0, y: 0 },
      size: { x: 300, y: 100 },
      region: undefined,
      tile: true,
    });
  });

  it("STRETCH_KEEP (2): the texture's intrinsic size, top-left (:53-55)", () => {
    expect(textureRectDraw(RECT, TEXTURE, 2)).toEqual({
      offset: { x: 0, y: 0 },
      size: { x: 320, y: 160 },
      region: undefined,
      tile: false,
    });
  });

  it("STRETCH_KEEP_CENTERED (3): the texture's intrinsic size, centered — offset can go negative (:56-59)", () => {
    // offset = (get_size() - texture->get_size()) / 2 = ((300,100)-(320,160))/2 = (-10,-30).
    expect(textureRectDraw(RECT, TEXTURE, 3)).toEqual({
      offset: { x: -10, y: -30 },
      size: { x: 320, y: 160 },
      region: undefined,
      tile: false,
    });
  });

  it('STRETCH_KEEP_ASPECT (4): fits height, no centering — top-left offset (:60-78, mode != CENTERED)', () => {
    // tex_width = 320 * 100/160 = 200 (<= 300, no re-clamp); tex_height = 100.
    expect(textureRectDraw(RECT, TEXTURE, 4)).toEqual({
      offset: { x: 0, y: 0 },
      size: { x: 200, y: 100 },
      region: undefined,
      tile: false,
    });
  });

  it('STRETCH_KEEP_ASPECT_CENTERED (5): the same fit, centered on the unused axis (:60-78, CENTERED branch)', () => {
    // offset.x += (300-200)/2 = 50; offset.y += (100-100)/2 = 0.
    expect(textureRectDraw(RECT, TEXTURE, 5)).toEqual({
      offset: { x: 50, y: 0 },
      size: { x: 200, y: 100 },
      region: undefined,
      tile: false,
    });
  });

  it('STRETCH_KEEP_ASPECT re-clamps to width when the height-driven fit overshoots it (:66-69)', () => {
    // A rect taller relative to the texture than KEEP_ASPECT above: 100x150,
    // same 320x160 texture. tex_width = 320*150/160 = 300 > 100 (rect width)
    // → re-clamp: tex_width = 100; tex_height = 160*100/320 = 50.
    expect(textureRectDraw({ x: 100, y: 150 }, TEXTURE, 4)).toEqual({
      offset: { x: 0, y: 0 },
      size: { x: 100, y: 50 },
      region: undefined,
      tile: false,
    });
  });

  it('STRETCH_KEEP_ASPECT_COVERED (6): draws the full rect, cropping a texture-space region (:79-89)', () => {
    // scale_size = (300/320, 100/160) = (0.9375, 0.625); scale = 0.9375 (width-driven).
    // scaled_tex_size = (300, 150); region.position = abs((300-300,150-100)/0.9375)/2 = (0, 80/3);
    // region.size = (300,100)/0.9375 = (320, 320/3).
    const draw = textureRectDraw(RECT, TEXTURE, 6);
    expect(draw.offset).toEqual({ x: 0, y: 0 });
    expect(draw.size).toEqual({ x: 300, y: 100 });
    expect(draw.tile).toBe(false);
    expect(draw.region?.x).toBeCloseTo(0);
    expect(draw.region?.y).toBeCloseTo(80 / 3);
    expect(draw.region?.w).toBeCloseTo(320);
    expect(draw.region?.h).toBeCloseTo(320 / 3);
  });

  it('degrades to STRETCH_SCALE-shaped output for a zero-dimension texture (defensive, no NaN/Infinity)', () => {
    const draw = textureRectDraw(RECT, { x: 0, y: 160 }, 4);
    expect(Number.isFinite(draw.size.x)).toBe(true);
    expect(Number.isFinite(draw.size.y)).toBe(true);
  });
});

describe('resolveTextureRectFilter (scene/main/canvas_item.h:52-60)', () => {
  it('maps every NEAREST* variant to nearest', () => {
    expect(resolveTextureRectFilter(1)).toBe('nearest'); // TEXTURE_FILTER_NEAREST
    expect(resolveTextureRectFilter(3)).toBe('nearest'); // TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
    expect(resolveTextureRectFilter(5)).toBe('nearest'); // TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC
  });

  it('maps every LINEAR* variant to linear', () => {
    expect(resolveTextureRectFilter(2)).toBe('linear'); // TEXTURE_FILTER_LINEAR
    expect(resolveTextureRectFilter(4)).toBe('linear'); // TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
    expect(resolveTextureRectFilter(6)).toBe('linear'); // TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
  });

  it('TEXTURE_FILTER_PARENT_NODE (0) and an absent value resolve to the CanvasItem root default, linear (canvas_item.h:121)', () => {
    expect(resolveTextureRectFilter(0)).toBe('linear');
    expect(resolveTextureRectFilter(undefined)).toBe('linear');
  });
});

describe('resolveTextureRectRepeat (scene/main/canvas_item.h:63-69)', () => {
  it('maps TEXTURE_REPEAT_ENABLED (2) to repeat', () => {
    expect(resolveTextureRectRepeat(2)).toBe('repeat');
  });

  it('maps TEXTURE_REPEAT_MIRROR (3) to mirror', () => {
    expect(resolveTextureRectRepeat(3)).toBe('mirror');
  });

  it('maps TEXTURE_REPEAT_DISABLED (1) to clamp', () => {
    expect(resolveTextureRectRepeat(1)).toBe('clamp');
  });

  it('TEXTURE_REPEAT_PARENT_NODE (0) and an absent value resolve to the CanvasItem root default, clamp/disabled (canvas_item.h:122)', () => {
    expect(resolveTextureRectRepeat(0)).toBe('clamp');
    expect(resolveTextureRectRepeat(undefined)).toBe('clamp');
  });
});

describe('applyFlip (texture_rect.cpp:92-93, `size.width *= hflip ? -1 : 1`, expressed as a UV mirror)', () => {
  it('is a no-op with neither flag set', () => {
    expect(applyFlip({ x: 1, y: 1 }, { x: 0, y: 0 }, false, false)).toEqual({
      repeat: { x: 1, y: 1 },
      offset: { x: 0, y: 0 },
    });
  });

  it('mirrors U in place for flip_h: a full [0,1] texture maps u=0 to the right edge', () => {
    const { repeat, offset } = applyFlip({ x: 1, y: 1 }, { x: 0, y: 0 }, true, false);
    expect(repeat).toEqual({ x: -1, y: 1 });
    expect(offset).toEqual({ x: 1, y: 0 });
    // u=0 -> offset.x + repeat.x*0 = 1 (right edge); u=1 -> 1-1=0 (left edge).
  });

  it('mirrors V in place for flip_v', () => {
    const { repeat, offset } = applyFlip({ x: 1, y: 1 }, { x: 0, y: 0 }, false, true);
    expect(repeat).toEqual({ x: 1, y: -1 });
    expect(offset).toEqual({ x: 0, y: 1 });
  });

  it('composes with an existing crop region (KEEP_ASPECT_COVERED + flip_h) rather than resetting it', () => {
    // A region window repeat=0.5, offset=0.25 (covers UV [0.25, 0.75]) flips to
    // traverse the SAME window in reverse: newOffset = offset+repeat = 0.75, newRepeat = -0.5.
    const { repeat, offset } = applyFlip({ x: 0.5, y: 1 }, { x: 0.25, y: 0 }, true, false);
    expect(repeat.x).toBeCloseTo(-0.5);
    expect(offset.x).toBeCloseTo(0.75);
  });

  it('both flags flip both axes independently', () => {
    const { repeat, offset } = applyFlip({ x: 1, y: 1 }, { x: 0, y: 0 }, true, true);
    expect(repeat).toEqual({ x: -1, y: -1 });
    expect(offset).toEqual({ x: 1, y: 1 });
  });

  it(
    'composed with STRETCH_TILE (repeat count > 1, RepeatWrapping): mirrors the WHOLE tiled ' +
      "pattern, not a single tile — matches Godot's own `size.width *= -1` (flips the destination " +
      'quad, not the source), because RepeatWrapping samples the fractional part of a negative ' +
      'coordinate the same way GLSL `fract()` does',
    () => {
      // rect 300x100 over a 320x160 texture in TILE mode: repeat = (300/320, 100/160) = (0.9375, 0.625).
      const draw = textureRectDraw({ x: 300, y: 100 }, TEXTURE, 1);
      const tileRepeat = { x: draw.size.x / TEXTURE.x, y: draw.size.y / TEXTURE.y };
      const { repeat, offset } = applyFlip(tileRepeat, { x: 0, y: 0 }, true, false);
      expect(repeat.x).toBeCloseTo(-0.9375);
      expect(offset.x).toBeCloseTo(0.9375);
      // At the destination's right edge (u=1): unflipped samples texture column
      // (rectW mod texW) = 300 mod 320 = 300; flipped must sample column
      // (rectW - rectW) mod texW = 0 — i.e. v(1) = offset + repeat*1 ≈ 0.
      expect(offset.x + repeat.x * 1).toBeCloseTo(0);
    }
  );
});
