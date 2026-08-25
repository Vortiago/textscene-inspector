/**
 * `rasterizeAtlasTexture` over a RAW-PIXEL sheet — the shape a `DataTexture`
 * carries in `.image`: `{ data, width, height }`, not a `CanvasImageSource`.
 *
 * Two production paths put one there. `applyAlphaBorderFix`
 * (`resources/formats/image/textureProcessing.ts`) substitutes a `DataTexture`
 * for any binary-alpha image whose transparent texels all border an opaque one
 * — the pixel-art sheets an AtlasTexture is cut from are exactly that — and
 * every procedural texture (`GradientTexture2D`, `NoiseTexture2D`) is one from
 * the start. `drawImage` rejects both, and a canvas could not be the answer
 * anyway: its backing store is premultiplied, so round-tripping through one
 * zeroes the very RGB behind alpha 0 that the alpha-border pass just wrote.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rasterizeAtlasTexture } from './build';
import type { AtlasTextureLayout } from './types';

/** A `w`x`h` RGBA sheet whose red channel is the texel index, fully opaque. */
function sheet(w: number, h: number): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = i;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

function layout(over: Partial<AtlasTextureLayout> = {}): AtlasTextureLayout {
  return { width: 2, height: 2, source: { x: 0, y: 0, width: 2, height: 2 }, dest: { x: 0, y: 0 }, ...over };
}

/** The crop's RGBA bytes. */
function bytes(texture: THREE.Texture | null): number[] {
  const image = texture?.image as { data?: Uint8Array } | undefined;
  return [...(image?.data ?? [])];
}

describe('rasterizeAtlasTexture — raw-pixel sheets', () => {
  it('cuts the region out of a DataTexture-shaped image', () => {
    // A 4x4 sheet; texel index = row*4 + col, so the bottom-right 2x2 is
    // 10, 11 / 14, 15.
    const texture = rasterizeAtlasTexture(
      sheet(4, 4),
      layout({ source: { x: 2, y: 2, width: 2, height: 2 } })
    );
    expect(texture).not.toBeNull();
    expect(bytes(texture).filter((_, i) => i % 4 === 0)).toEqual([10, 11, 14, 15]);
  });

  it('leaves the margin transparent rather than sampling past the region', () => {
    // A 1x1 region placed at (1, 1) of a 3x3 box: eight transparent texels
    // around one opaque one.
    const texture = rasterizeAtlasTexture(
      sheet(2, 2),
      layout({
        width: 3,
        height: 3,
        source: { x: 1, y: 1, width: 1, height: 1 },
        dest: { x: 1, y: 1 },
      })
    );
    const alpha = bytes(texture).filter((_, i) => i % 4 === 3);
    expect(alpha).toEqual([0, 0, 0, 0, 255, 0, 0, 0, 0]);
  });

  it('clips a region that overhangs the sheet, keeping the covered part', () => {
    // Godot intersects the sampled rect with the atlas (`atlas_texture.cpp:208`)
    // and draws nothing when the result is empty.
    const texture = rasterizeAtlasTexture(
      sheet(2, 2),
      layout({ source: { x: 1, y: 1, width: 2, height: 2 } })
    );
    const alpha = bytes(texture).filter((_, i) => i % 4 === 3);
    expect(alpha).toEqual([255, 0, 0, 0]);
    expect(bytes(texture)[0]).toBe(3);
  });

  it('returns null for a region entirely off the sheet', () => {
    expect(
      rasterizeAtlasTexture(sheet(2, 2), layout({ source: { x: 8, y: 8, width: 2, height: 2 } }))
    ).toBeNull();
  });

  it('carries the sheet as undecoded sRGB, the tag a loaded image gets', () => {
    expect(rasterizeAtlasTexture(sheet(2, 2), layout())?.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});
