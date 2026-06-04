/** Unit tests for the shared sprite-frame composition module. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { composeFrameTexture, frameSizePx, type SpriteFrameProps } from './spriteFrame';

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
    expect(composeFrameTexture(undefined, baseProps())).toBeUndefined();
  });

  it('clones the texture (never mutates the shared cache entry)', () => {
    const source = makeTexture();
    const result = composeFrameTexture(source, baseProps({ hframes: 4 }));
    expect(result).not.toBe(source);
    expect(source.repeat.x).toBe(1); // source untouched
    expect(result?.repeat.x).toBeCloseTo(0.25);
  });

  it('leaves UVs at identity for a plain full-image sprite', () => {
    const result = composeFrameTexture(makeTexture(), baseProps())!;
    expect(result.repeat.x).toBe(1);
    expect(result.repeat.y).toBe(1);
    expect(result.offset.x).toBe(0);
    expect(result.offset.y).toBe(0);
    expect(result.wrapS).toBe(THREE.RepeatWrapping);
    expect(result.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('windows UVs to a region_rect (image-Y top-left → UV-Y bottom-left)', () => {
    const result = composeFrameTexture(
      makeTexture(100, 80),
      baseProps({ region_enabled: true, region_rect: { x: 10, y: 20, width: 50, height: 40 } })
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
      baseProps({ region_enabled: true, region_rect: { x: 10, y: 20, width: 50, height: 40 } })
    )!;
    expect(result.repeat.x).toBe(1);
    expect(result.offset.x).toBe(0);
  });

  it('selects a sprite-sheet frame from the linear frame index (row 0 at the top)', () => {
    // 4×2 grid, frame 5 → col 1, row 1 (bottom row in UV space).
    const result = composeFrameTexture(
      makeTexture(),
      baseProps({ hframes: 4, vframes: 2, frame: 5 })
    )!;
    expect(result.repeat.x).toBeCloseTo(0.25);
    expect(result.repeat.y).toBeCloseTo(0.5);
    expect(result.offset.x).toBeCloseTo(0.25);
    expect(result.offset.y).toBeCloseTo(0);
  });

  it('lets frame_coords override the linear frame index', () => {
    const result = composeFrameTexture(
      makeTexture(),
      baseProps({ hframes: 4, vframes: 2, frame: 5, frame_coords: { x: 3, y: 0 } })
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
      })
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
