import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  composeFrameTexture,
  frameSizePx,
  spriteWrapMode,
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
    expect(composeFrameTexture(undefined, baseProps(), 'clamp', THREE.SRGBColorSpace)).toBeUndefined();
  });

  it('clones the texture (never mutates the shared cache entry)', () => {
    const source = makeTexture();
    const result = composeFrameTexture(source, baseProps({ hframes: 4 }), 'clamp', THREE.SRGBColorSpace);
    expect(result).not.toBe(source);
    expect(source.repeat.x).toBe(1); // source untouched
    expect(result?.repeat.x).toBeCloseTo(0.25);
  });

  it('leaves UVs at identity for a plain full-image sprite', () => {
    const result = composeFrameTexture(makeTexture(), baseProps(), 'clamp', THREE.SRGBColorSpace)!;
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
      'clamp', THREE.SRGBColorSpace
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
      'clamp', THREE.SRGBColorSpace
    )!;
    expect(result.repeat.x).toBe(1);
    expect(result.offset.x).toBe(0);
  });

  it('selects a sprite-sheet frame from the linear frame index (row 0 at the top)', () => {
    // 4×2 grid, frame 5 → col 1, row 1 (bottom row in UV space).
    const result = composeFrameTexture(
      makeTexture(),
      baseProps({ hframes: 4, vframes: 2, frame: 5 }),
      'clamp', THREE.SRGBColorSpace
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
      'clamp', THREE.SRGBColorSpace
    )!;
    expect(result.offset.x).toBeCloseTo(0.75);
    expect(result.offset.y).toBeCloseTo(0.5); // row 0 = top half
  });

  it('retags the clone with the caller-supplied colorSpace, independent of the source', () => {
    const source = makeTexture();
    source.colorSpace = THREE.SRGBColorSpace;
    const result = composeFrameTexture(source, baseProps(), 'clamp', THREE.NoColorSpace);
    expect(result?.colorSpace).toBe(THREE.NoColorSpace);
    expect(source.colorSpace).toBe(THREE.SRGBColorSpace); // source untouched
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
      'clamp', THREE.SRGBColorSpace
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

describe('composeFrameTexture — region_rect larger than its texture', () => {
  /**
   * Godot does not clip an oversized region: `Sprite2D::_get_rects` takes
   * `base_rect = region_rect` and `frame_size = base_rect.size / Size2(hframes, vframes)`,
   * and `Texture2D::get_rect_region` passes it through (scene/resources/texture.cpp).
   * The UV window exceeds 1.0, and only the sampler decides what fills the overrun.
   */
  const oversized = () =>
    baseProps({ region_enabled: true, region_rect: { x: 0, y: 0, width: 200, height: 40 } });

  it('keeps the UV window at the full region — no clipping to the image', () => {
    // 100×80 image, 200-wide region → repeat.x = 2.0, deliberately > 1.
    const result = composeFrameTexture(makeTexture(100, 80), oversized(), 'clamp', THREE.SRGBColorSpace)!;
    expect(result.repeat.x).toBeCloseTo(2);
    expect(result.repeat.y).toBeCloseTo(0.5);
    expect(result.offset.x).toBeCloseTo(0);
    expect(result.offset.y).toBeCloseTo(0.5);
  });

  it("clamps the overrun on the 2D canvas (Viewport's texture repeat is DISABLED)", () => {
    const result = composeFrameTexture(makeTexture(100, 80), oversized(), 'clamp', THREE.SRGBColorSpace)!;
    expect(result.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(result.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('tiles the overrun for a sprite whose derived wrap mode is REPEAT', () => {
    const result = composeFrameTexture(makeTexture(100, 80), oversized(), 'repeat', THREE.SRGBColorSpace)!;
    expect(result.wrapS).toBe(THREE.RepeatWrapping);
    expect(result.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('keeps the quad at the full region size (Godot sizes dst_rect from base_rect)', () => {
    // `get_rect()` uses `s = region_rect.size`: the sprite does not shrink to
    // the part of the region the texture covers.
    expect(frameSizePx(makeTexture(100, 80), oversized())).toEqual({ width: 200, height: 40 });
  });
});

describe('spriteWrapMode — Godot\'s own texture_repeat derivation', () => {
  /**
   * `sprite_3d.cpp:163` decides repeat from the frame's UV corners alone, on strict
   * `< 0.0` / `> 1.0` tests, so a window touching the edge clamps. Flips swap the
   * uv pairs (`:154-161`) without moving the bounding box, and our mirrored
   * v-window is symmetric under the test, so this reads the unflipped window.
   */
  it('clamps a plain full-image sprite — the common case', () => {
    expect(spriteWrapMode(makeTexture(), baseProps())).toBe('clamp');
  });

  it('clamps a region that stays inside the texture', () => {
    const props = baseProps({
      region_enabled: true,
      region_rect: { x: 10, y: 20, width: 50, height: 40 },
    });
    expect(spriteWrapMode(makeTexture(100, 80), props)).toBe('clamp');
  });

  it('clamps a region covering the texture EXACTLY — the tests are strict', () => {
    const props = baseProps({
      region_enabled: true,
      region_rect: { x: 0, y: 0, width: 100, height: 80 },
    });
    expect(spriteWrapMode(makeTexture(100, 80), props)).toBe('clamp');
  });

  it('repeats a region overrunning the far edge', () => {
    const props = baseProps({
      region_enabled: true,
      region_rect: { x: 0, y: 0, width: 200, height: 40 },
    });
    expect(spriteWrapMode(makeTexture(100, 80), props)).toBe('repeat');
  });

  it('repeats a region starting before the texture origin', () => {
    const props = baseProps({
      region_enabled: true,
      region_rect: { x: -10, y: 0, width: 50, height: 40 },
    });
    expect(spriteWrapMode(makeTexture(100, 80), props)).toBe('repeat');
  });

  it('clamps a sprite-sheet frame, which only ever subdivides the base rect', () => {
    const props = baseProps({ hframes: 3, vframes: 2, frame: 4 });
    expect(spriteWrapMode(makeTexture(90, 80), props)).toBe('clamp');
  });

  it('clamps before the image has loaded, where no window can be computed', () => {
    const props = baseProps({
      region_enabled: true,
      region_rect: { x: 0, y: 0, width: 200, height: 40 },
    });
    expect(spriteWrapMode(undefined, props)).toBe('clamp');
    expect(spriteWrapMode(new THREE.Texture(), props)).toBe('clamp');
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
