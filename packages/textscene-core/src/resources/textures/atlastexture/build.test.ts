/**
 * `rasterizeAtlasTexture` over a raw-pixel sheet, a `DataTexture`. `applyAlphaBorderFix`
 * (`resources/formats/image/textureProcessing.ts`) makes a top-down one with `flipY` from a
 * decoded image, and every procedural texture is a bottom-up one without it.
 * `build.decoded.test.ts` covers a sheet that stays a decoded image.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rasterizeAtlasTexture } from './build';
import type { AtlasTextureLayout } from './types';

/**
 * A `w`x`h` top-down RGBA sheet with `flipY`, as `applyAlphaBorderFix` makes, whose red channel
 * is the texel index in its own row order, fully opaque.
 */
function sheet(w: number, h: number, flipY = true): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = i;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.flipY = flipY;
  return texture;
}

/** The same sheet bottom-up without `flipY`, as a procedural texture is. */
const bottomUpSheet = (w: number, h: number) => sheet(w, h, false);

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

  it("keeps a top-down sheet's orientation and its flipY", () => {
    expect(rasterizeAtlasTexture(sheet(4, 4), layout())?.flipY).toBe(true);
  });

  it('cuts the region in Godot rows out of a bottom-up sheet, keeping it bottom-up', () => {
    // Raw row 0 is the bottom row, so Godot rows 2 and 3 are raw rows 1 and 0: 6, 7 and 2, 3.
    // The crop stores its bottom row, Godot row 3, first.
    const texture = rasterizeAtlasTexture(
      bottomUpSheet(4, 4),
      layout({ source: { x: 2, y: 2, width: 2, height: 2 } })
    );
    expect(bytes(texture).filter((_, i) => i % 4 === 0)).toEqual([2, 3, 6, 7]);
    expect(texture?.flipY).toBe(false);
  });

  it('places a bottom-up crop at its Godot destination row', () => {
    // A 1x1 region at Godot (1, 0) of a 2x2 box: the top-right texel, stored last bottom-up.
    const texture = rasterizeAtlasTexture(
      bottomUpSheet(2, 2),
      layout({ source: { x: 0, y: 0, width: 1, height: 1 }, dest: { x: 1, y: 0 } })
    );
    const alpha = bytes(texture).filter((_, i) => i % 4 === 3);
    expect(alpha).toEqual([0, 0, 0, 255]);
    // Godot row 0 of a 2-row bottom-up sheet is raw row 1, whose first texel is index 2.
    expect(bytes(texture)[12]).toBe(2);
  });

  it("samples as its sheet does, not with a DataTexture's nearest, mip-free default", () => {
    const linear = sheet(4, 4);
    linear.magFilter = THREE.LinearFilter;
    linear.minFilter = THREE.LinearMipmapLinearFilter;
    linear.generateMipmaps = true;

    const crop = rasterizeAtlasTexture(linear, layout())!;

    expect(crop.magFilter).toBe(THREE.LinearFilter);
    expect(crop.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(crop.generateMipmaps).toBe(true);
  });

  it('carries the sheet as undecoded sRGB, the tag a loaded image gets', () => {
    expect(rasterizeAtlasTexture(sheet(2, 2), layout())?.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('keeps a half-float sheet in half floats, so a channel past 1 survives (edge case)', () => {
    const two = THREE.DataUtils.toHalfFloat(2);
    const halfSheet = new THREE.DataTexture(
      new Uint16Array([two, 0, 0, two, 0, 0, 0, 0]),
      2,
      1,
      THREE.RGBAFormat
    );
    halfSheet.type = THREE.HalfFloatType;
    const crop = rasterizeAtlasTexture(
      halfSheet,
      layout({ width: 1, height: 1, source: { x: 0, y: 0, width: 1, height: 1 } })
    );
    expect(crop?.type).toBe(THREE.HalfFloatType);
    expect(crop?.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(Array.from((crop?.image as { data: Uint16Array }).data)).toEqual([two, 0, 0, two]);
  });
});
