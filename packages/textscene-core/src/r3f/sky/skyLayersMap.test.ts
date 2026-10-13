import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LAST_LAYER_FACE_SIZE, ROUGH_LAYER_FACE_SIZES, type SkyLayers } from '../../resources/sky/skyLayers';
import { showSkyLayers, skyContribution, skyLastLayerMap, skyRoughLayersMap } from './skyLayersMap';

/** Six faces `size` wide, each holding `value`. */
function faces(size: number, value: number): Uint16Array[] {
  return Array.from({ length: 6 }, () =>
    new Uint16Array(size * size * 4).fill(THREE.DataUtils.toHalfFloat(value))
  );
}

function skyLayers(value: number): SkyLayers {
  return {
    rough: ROUGH_LAYER_FACE_SIZES.map((size) => faces(size, value)),
    last: faces(LAST_LAYER_FACE_SIZE, value),
  };
}

/** The data of each face of mip `level` of `cube`, the base level being 0. */
function facesAt(cube: THREE.CubeTexture, level: number): unknown[] {
  const mip = cube.mipmaps[level - 1] as unknown as { image: THREE.DataTexture[] } | undefined;
  const levelFaces = (level === 0 ? cube.image : mip!.image) as THREE.DataTexture[];
  return levelFaces.map((face) => face.image.data);
}

describe('skyRoughLayersMap', () => {
  it('holds black half-float rough layers before any sky shows, a mip each', () => {
    const base = skyRoughLayersMap.image as THREE.DataTexture[];
    expect(base).toHaveLength(6);
    expect(base[0]!.image).toMatchObject({
      width: ROUGH_LAYER_FACE_SIZES[0],
      height: ROUGH_LAYER_FACE_SIZES[0],
    });
    expect(skyRoughLayersMap.mipmaps).toHaveLength(ROUGH_LAYER_FACE_SIZES.length - 1);
    expect(skyRoughLayersMap.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });

  it('is its own clone, so every material samples the layers a sky shows', () => {
    expect(skyRoughLayersMap.clone()).toBe(skyRoughLayersMap);
  });
});

describe('skyLastLayerMap', () => {
  it('holds one black half-float layer with no mips before any sky shows', () => {
    expect((skyLastLayerMap.image as THREE.DataTexture[])[0]!.image).toMatchObject({
      width: LAST_LAYER_FACE_SIZE,
      height: LAST_LAYER_FACE_SIZE,
    });
    expect(skyLastLayerMap.mipmaps).toEqual([]);
    expect(skyLastLayerMap.minFilter).toBe(THREE.LinearFilter);
  });
});

describe('skyContribution', () => {
  it('is its own clone, so every material reads the share a sky shows', () => {
    expect(skyContribution.clone()).toBe(skyContribution);
  });
});

describe('showSkyLayers', () => {
  it('puts the rough layers in the mips of one cube and the last in the other, and uploads them', () => {
    const sky = skyLayers(0.5);
    const versions = [skyRoughLayersMap.version, skyLastLayerMap.version];

    showSkyLayers(sky, 1);

    expect(facesAt(skyRoughLayersMap, 0)).toEqual(sky.rough[0]);
    expect(facesAt(skyRoughLayersMap, ROUGH_LAYER_FACE_SIZES.length - 1)).toEqual(sky.rough.at(-1));
    expect(facesAt(skyLastLayerMap, 0)).toEqual(sky.last);
    expect([skyRoughLayersMap.version, skyLastLayerMap.version]).toEqual(versions.map((v) => v + 1));
  });

  it("shows the sky's share of the ambient", () => {
    showSkyLayers(skyLayers(0.5), 0.3);

    expect(skyContribution.x).toBe(0.3);
  });

  it('shows a new share with layers the cubes already hold (edge case)', () => {
    const sky = skyLayers(0.75);
    showSkyLayers(sky, 1);

    showSkyLayers(sky, 0);

    expect(skyContribution.x).toBe(0);
  });

  it('uploads nothing for the layers the cubes already hold (edge case)', () => {
    const sky = skyLayers(0.25);
    showSkyLayers(sky, 1);
    const version = skyRoughLayersMap.version;

    showSkyLayers(sky, 1);

    expect(skyRoughLayersMap.version).toBe(version);
  });
});
