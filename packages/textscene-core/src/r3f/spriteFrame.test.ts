/** Unit tests for the shared sprite-frame composition module. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  composeFrameTexture,
  frameSizePx,
  needsFrameComposition,
  type SpriteFrameProps,
} from './spriteFrame';

function makeTexture(width = 100, height = 80): THREE.Texture {
  const texture = new THREE.Texture();
  texture.image = { width, height };
  return texture;
}

function baseProps(overrides: Partial<SpriteFrameProps> = {}): SpriteFrameProps {
  return {
    region_enabled: false,
    hframes: 1,
    vframes: 1,
    frame: 0,
    ...overrides,
  };
}

describe('composeFrameTexture', () => {
  it('returns undefined when no texture is loaded', () => {
    expect(composeFrameTexture(undefined, baseProps(), 'clamp')).toBeUndefined();
  });

  it('clones the texture (never mutates the shared cache entry)', () => {
    const source = makeTexture();
    const result = composeFrameTexture(source, baseProps({ hframes: 4 }), 'clamp');
    expect(result).not.toBe(source);
    expect(source.repeat.x).toBe(1); // source untouched
    expect(result?.repeat.x).toBeCloseTo(0.25);
  });

  it('leaves UVs at identity for a plain full-image sprite', () => {
    const result = composeFrameTexture(makeTexture(), baseProps(), 'clamp')!;
    expect(result.repeat.x).toBe(1);
    expect(result.repeat.y).toBe(1);
    expect(result.offset.x).toBe(0);
    expect(result.offset.y).toBe(0);
    expect(result.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(result.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('windows UVs to a region_rect (image-Y top-left → UV-Y bottom-left)', () => {
    const result = composeFrameTexture(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 10, y: 20, width: 50, height: 40 } }),
      'clamp'
    )!;
    expect(result.repeat.x).toBeCloseTo(0.5);
    expect(result.repeat.y).toBeCloseTo(0.5);
    expect(result.offset.x).toBeCloseTo(0.1);
    // 1 - (y + h)/imgH = 1 - 60/80
    expect(result.offset.y).toBeCloseTo(0.25);
  });

  it('skips the region when the image has no dimensions', () => {
    const texture = new THREE.Texture(); // no image
    const result = composeFrameTexture(
      texture,
      baseProps({ region_enabled: true, region_rect: { x: 10, y: 20, width: 50, height: 40 } }),
      'clamp'
    )!;
    expect(result.repeat.x).toBe(1);
    expect(result.offset.x).toBe(0);
  });

  it('selects a sprite-sheet frame from the linear frame index (row 0 at the top)', () => {
    // 4×2 grid, frame 5 → col 1, row 1 (bottom row in UV space).
    const result = composeFrameTexture(
      makeTexture(),
      baseProps({ hframes: 4, vframes: 2, frame: 5 }),
      'clamp'
    )!;
    expect(result.repeat.x).toBeCloseTo(0.25);
    expect(result.repeat.y).toBeCloseTo(0.5);
    expect(result.offset.x).toBeCloseTo(0.25);
    expect(result.offset.y).toBeCloseTo(0);
  });

  it('lets frame_coords override the linear frame index', () => {
    const result = composeFrameTexture(
      makeTexture(),
      baseProps({ hframes: 4, vframes: 2, frame: 5, frame_coords: { x: 3, y: 0 } }),
      'clamp'
    )!;
    expect(result.offset.x).toBeCloseTo(0.75);
    expect(result.offset.y).toBeCloseTo(0.5); // row 0 = top half
  });

  it('composes region_rect THEN frame grid (Godot base_rect-then-subdivide)', () => {
    // 100×80 image, region (0,0,100,40) = top half; 5×1 grid, frame 2.
    const result = composeFrameTexture(
      makeTexture(100, 80),
      baseProps({
        region_enabled: true,
        region_rect: { x: 0, y: 0, width: 100, height: 40 },
        hframes: 5,
        vframes: 1,
        frame: 2,
      }),
      'clamp'
    )!;
    // repeat = region repeat / grid: (1.0/5, 0.5/1)
    expect(result.repeat.x).toBeCloseTo(0.2);
    expect(result.repeat.y).toBeCloseTo(0.5);
    // offset.x = region offset + col × frame width = 0 + 2×0.2
    expect(result.offset.x).toBeCloseTo(0.4);
    // region offset.y (0.5) + region repeat (0.5) − (row+1) × 0.5 = 0.5
    expect(result.offset.y).toBeCloseTo(0.5);
  });
});

describe('composeFrameTexture — an AtlasTexture region as the base rect', () => {
  // Godot's AtlasTexture remaps every draw into its region
  // (atlas_texture.cpp `get_rect_region`), so the region IS the sprite's
  // "full image": region_rect coordinates and the frame grid live inside it.
  const ATLAS = { x: 20, y: 16, width: 40, height: 32 };

  it('windows UVs to the atlas region when the sprite adds nothing', () => {
    const result = composeFrameTexture(makeTexture(100, 80), baseProps(), 'clamp', ATLAS)!;
    expect(result.repeat.x).toBeCloseTo(0.4);
    expect(result.repeat.y).toBeCloseTo(0.4);
    expect(result.offset.x).toBeCloseTo(0.2);
    // image-Y 16..48 of 80 → UV-Y offset 1 - 48/80
    expect(result.offset.y).toBeCloseTo(1 - 48 / 80);
  });

  it('translates a sprite region_rect by the atlas origin', () => {
    const result = composeFrameTexture(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 10, y: 8, width: 20, height: 16 } }),
      'clamp',
      ATLAS
    )!;
    // Sheet-space rect: (20+10, 16+8, 20, 16)
    expect(result.repeat.x).toBeCloseTo(0.2);
    expect(result.repeat.y).toBeCloseTo(0.2);
    expect(result.offset.x).toBeCloseTo(0.3);
    expect(result.offset.y).toBeCloseTo(1 - 40 / 80);
  });

  it('subdivides the atlas region by the frame grid', () => {
    const result = composeFrameTexture(
      makeTexture(100, 80),
      baseProps({ hframes: 2, vframes: 2, frame: 3 }),
      'clamp',
      ATLAS
    )!;
    // Quarter of the atlas window, bottom-right frame.
    expect(result.repeat.x).toBeCloseTo(0.2);
    expect(result.repeat.y).toBeCloseTo(0.2);
    expect(result.offset.x).toBeCloseTo(0.2 + 0.2);
    expect(result.offset.y).toBeCloseTo(1 - 48 / 80);
  });

  // An AtlasTexture is the ONE texture kind Godot clips an oversized source rect
  // against: `get_rect_region` intersects it with the cell
  // (`src_clipped = _get_region_rect().intersection(src)`, atlas_texture.cpp:204)
  // and draws nothing when that comes back empty. A plain Texture2D is never
  // clipped — the sibling suite below pins that opposite rule — so an unclipped
  // atlas sprite bleeds pixels from the neighbouring cell.
  it('CLIPS a sprite region_rect that overruns its atlas cell', () => {
    const result = composeFrameTexture(
      makeTexture(100, 80),
      // Starts inside the cell, runs 20px past its right edge and 16px past the bottom.
      baseProps({ region_enabled: true, region_rect: { x: 20, y: 16, width: 40, height: 32 } }),
      'clamp',
      ATLAS
    )!;
    // Sheet-space rect (40, 32, 40, 32) ∩ cell (20, 16, 40, 32) = (40, 32, 20, 16).
    expect(result.repeat.x).toBeCloseTo(20 / 100);
    expect(result.repeat.y).toBeCloseTo(16 / 80);
    expect(result.offset.x).toBeCloseTo(40 / 100);
    expect(result.offset.y).toBeCloseTo(1 - 48 / 80);
  });

  it('draws NOTHING when the sprite region_rect misses the cell entirely', () => {
    // Godot's get_rect_region returns false for an empty intersection, so the
    // draw is skipped — not "fall back to the whole cell", which would show a
    // frame the engine does not.
    expect(
      composeFrameTexture(
        makeTexture(100, 80),
        baseProps({ region_enabled: true, region_rect: { x: 60, y: 0, width: 20, height: 16 } }),
        'clamp',
        ATLAS
      )
    ).toBeUndefined();
  });

  it('leaves a region_rect that fits inside the cell untouched', () => {
    // The clip must not shrink a legitimate sub-rect (the common case).
    const result = composeFrameTexture(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 4, y: 4, width: 8, height: 8 } }),
      'clamp',
      ATLAS
    )!;
    expect(result.repeat.x).toBeCloseTo(8 / 100);
    expect(result.repeat.y).toBeCloseTo(8 / 80);
    expect(result.offset.x).toBeCloseTo(24 / 100);
    expect(result.offset.y).toBeCloseTo(1 - 28 / 80);
  });
});

describe('frameSizePx — atlas region sizing', () => {
  it('sizes by the atlas region, not the sheet', () => {
    const size = frameSizePx(makeTexture(100, 80), baseProps(), {
      x: 20,
      y: 16,
      width: 40,
      height: 32,
    });
    expect(size).toEqual({ width: 40, height: 32 });
  });

  it('a sprite region inside an atlas keeps the sprite region dims', () => {
    const size = frameSizePx(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 0, y: 0, width: 10, height: 6 } }),
      { x: 20, y: 16, width: 40, height: 32 }
    );
    expect(size).toEqual({ width: 10, height: 6 });
  });

  it('sizes by the CLIPPED rect when the sprite region overruns the cell', () => {
    // The quad must match the pixels that survive the clip, or the cell's
    // content is stretched over a quad the engine never draws that big.
    const size = frameSizePx(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 20, y: 16, width: 40, height: 32 } }),
      { x: 20, y: 16, width: 40, height: 32 }
    );
    expect(size).toEqual({ width: 20, height: 16 });
  });
});

describe('composeFrameTexture — region_rect larger than its texture', () => {
  /**
   * Godot does not clip an oversized region. `Sprite2D::_get_rects` takes the
   * region verbatim —
   *
   *     if (region_enabled) { ... base_rect = region_rect; }
   *     Size2 frame_size = base_rect.size / Size2(hframes, vframes);
   *     r_src_rect.size = frame_size;
   *
   * — and `Texture2D::get_rect_region` is a pass-through (`r_src_rect =
   * p_src_rect`, scene/resources/texture.cpp), so the src rect keeps running
   * past the image. The UV window therefore exceeds 1.0 and stays there; what
   * fills the overrun is decided by the sampler alone, which is what
   * `SpriteWrapMode` selects. Nothing about the WINDOW changes.
   */
  const oversized = () =>
    baseProps({ region_enabled: true, region_rect: { x: 0, y: 0, width: 200, height: 40 } });

  it('keeps the UV window at the full region — no clipping to the image', () => {
    // 100×80 image, 200-wide region → repeat.x = 2.0, deliberately > 1.
    const result = composeFrameTexture(makeTexture(100, 80), oversized(), 'clamp')!;
    expect(result.repeat.x).toBeCloseTo(2);
    expect(result.repeat.y).toBeCloseTo(0.5);
    expect(result.offset.x).toBeCloseTo(0);
    expect(result.offset.y).toBeCloseTo(0.5);
  });

  it("clamps the overrun on the 2D canvas (Viewport's texture repeat is DISABLED)", () => {
    const result = composeFrameTexture(makeTexture(100, 80), oversized(), 'clamp')!;
    expect(result.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(result.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('tiles the overrun for Sprite3D (StandardMaterial3D keeps FLAG_USE_TEXTURE_REPEAT)', () => {
    const result = composeFrameTexture(makeTexture(100, 80), oversized(), 'repeat')!;
    expect(result.wrapS).toBe(THREE.RepeatWrapping);
    expect(result.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('keeps the quad at the full region size (Godot sizes dst_rect from base_rect)', () => {
    // `get_rect()` uses `s = region_rect.size` — the sprite does NOT shrink to
    // the part of the region the texture actually covers.
    expect(frameSizePx(makeTexture(100, 80), oversized())).toEqual({ width: 200, height: 40 });
  });
});

describe('frameSizePx', () => {
  it('falls back to 1×1 without a loaded image', () => {
    expect(frameSizePx(undefined, baseProps())).toEqual({ width: 1, height: 1 });
  });

  it('returns the full image size for a plain sprite', () => {
    expect(frameSizePx(makeTexture(100, 80), baseProps())).toEqual({ width: 100, height: 80 });
  });

  it('returns the region size when region_enabled', () => {
    const size = frameSizePx(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 10, y: 20, width: 50, height: 40 } })
    );
    expect(size).toEqual({ width: 50, height: 40 });
  });

  it('subdivides the base rect by the frame grid (region + frames compose)', () => {
    const size = frameSizePx(
      makeTexture(100, 80),
      baseProps({
        region_enabled: true,
        region_rect: { x: 0, y: 0, width: 100, height: 40 },
        hframes: 5,
        vframes: 2,
      })
    );
    expect(size).toEqual({ width: 20, height: 20 });
  });
});

describe('needsFrameComposition', () => {
  it('is false for a whole-image sprite (nothing to window)', () => {
    expect(needsFrameComposition(baseProps())).toBe(false);
  });

  it('is false for region_enabled without a region_rect (nothing to apply)', () => {
    expect(needsFrameComposition(baseProps({ region_enabled: true }))).toBe(false);
  });

  it('is true for a region, a frame grid, or an atlas cell', () => {
    expect(
      needsFrameComposition(
        baseProps({ region_enabled: true, region_rect: { x: 0, y: 0, width: 10, height: 10 } })
      )
    ).toBe(true);
    expect(needsFrameComposition(baseProps({ hframes: 2 }))).toBe(true);
    expect(needsFrameComposition(baseProps({ vframes: 3 }))).toBe(true);
    expect(needsFrameComposition(baseProps(), { x: 0, y: 0, width: 8, height: 8 })).toBe(true);
  });
});
