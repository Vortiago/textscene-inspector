import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SKY_LAYER_GROUPS, type SkyLayers } from '../../resources/sky/skyLayers';
import { showSkyLayers, skyContribution, skyLayerMaps } from './skyLayersMap';

const { sharp, last } = skyLayerMaps;
const GROUPS = ['sharp', 'rough', 'last'] as const;

/** Six faces `size` wide, each holding `value`. */
function faces(size: number, value: number): Uint16Array[] {
  return Array.from({ length: 6 }, () =>
    new Uint16Array(size * size * 4).fill(THREE.DataUtils.toHalfFloat(value))
  );
}

function skyLayers(value: number): SkyLayers {
  const group = (sizes: readonly number[]) => sizes.map((size) => faces(size, value));
  return {
    sharp: group(SKY_LAYER_GROUPS.sharp.faceSizes),
    rough: group(SKY_LAYER_GROUPS.rough.faceSizes),
    last: group(SKY_LAYER_GROUPS.last.faceSizes),
  };
}

/** The data of each face of mip `level` of `cube`, the base level being 0. */
function facesAt(cube: THREE.CubeTexture, level: number): unknown[] {
  const mip = cube.mipmaps[level - 1] as unknown as { image: THREE.DataTexture[] } | undefined;
  const levelFaces = (level === 0 ? cube.image : mip!.image) as THREE.DataTexture[];
  return levelFaces.map((face) => face.image.data);
}

describe.each(['sharp', 'rough'] as const)('the %s layers cube', (group) => {
  const cube = skyLayerMaps[group];
  const { faceSizes } = SKY_LAYER_GROUPS[group];

  it('holds black half-float layers before any sky shows, a mip each', () => {
    const base = cube.image as THREE.DataTexture[];
    expect(base).toHaveLength(6);
    expect(base[0]!.image).toMatchObject({ width: faceSizes[0], height: faceSizes[0] });
    expect(cube.mipmaps).toHaveLength(faceSizes.length - 1);
    expect(cube.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });

  it('is its own clone, so every material samples the layers a sky shows', () => {
    expect(cube.clone()).toBe(cube);
  });
});

describe('the last layer cube', () => {
  it('holds one black half-float layer with no mips before any sky shows', () => {
    const [size] = SKY_LAYER_GROUPS.last.faceSizes;
    expect((last.image as THREE.DataTexture[])[0]!.image).toMatchObject({ width: size, height: size });
    expect(last.mipmaps).toEqual([]);
    expect(last.minFilter).toBe(THREE.LinearFilter);
  });
});

describe('showSkyLayers', () => {
  it("puts each group's layers in the mips of its cube, and uploads them", () => {
    const sky = skyLayers(0.5);
    const versions = GROUPS.map((group) => skyLayerMaps[group].version);

    showSkyLayers(sky, 1);

    for (const group of GROUPS) {
      sky[group].forEach((layer, mip) =>
        facesAt(skyLayerMaps[group], mip).forEach((face, index) => expect(face).toBe(layer[index]))
      );
    }
    expect(GROUPS.map((group) => skyLayerMaps[group].version)).toEqual(versions.map((v) => v + 1));
  });

  it("shows the sky's share of the ambient", () => {
    showSkyLayers(skyLayers(0.5), 0.3);

    expect(skyContribution[0]).toBeCloseTo(0.3);
  });

  it('shows a new share with layers the cubes already hold (edge case)', () => {
    const sky = skyLayers(0.75);
    showSkyLayers(sky, 1);

    showSkyLayers(sky, 0);

    expect(skyContribution[0]).toBe(0);
  });

  it('uploads nothing for the layers the cubes already hold (edge case)', () => {
    const sky = skyLayers(0.25);
    showSkyLayers(sky, 1);
    const version = sharp.version;

    showSkyLayers(sky, 1);

    expect(sharp.version).toBe(version);
  });
});
