/**
 * The FogVolumes the volumetric fog draws, packed as the light pass reads them: what fills each one,
 * its shape, and the froxels Godot 4.6.3's pass covers (`environment/fog.cpp:567-790`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FogVolumeShape } from '../../godot/fogVolume';
import { decodeFogMaterial } from '../../resources/materials/fogmaterial/decode';
import { FogDensityAtlas } from './fogDensityAtlas';
import { FogVolumeObject, type FogVolumeFill } from './fogVolumeObject';
import { FOG_VOLUME_TEXELS, FogVolumeRows, FogVolumeTexel, type FogVolumeView } from './fogVolumeRows';

/** The camera of `unit-fog-volume`: at (0, 3, 8), looking down -Z. */
function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(75, 955 / 756, 0.05, 4000);
  view.position.set(0, 3, 8);
  view.updateMatrixWorld();
  return view;
}

/** Its volumetric fog: a 64-unit fog over a 71×56×64 grid, the near plane's corner 0.08 away. */
const FRAME: FogVolumeView = {
  grid: { width: 71, height: 56, depth: 64 },
  begin: { x: 0.0485, y: 0.0384 },
  end: { x: 62.1, y: 49.2 },
  length: 64,
  detailSpread: 2,
  nearCornerDistance: 0.08,
};

/** An atlas holding no texture, for volumes without a density texture. */
const ATLAS = new FogDensityAtlas();

/** A FogMaterial of density 1, with `densityTexture`. */
function fogMaterial(densityTexture: THREE.Data3DTexture | null = null): FogVolumeFill {
  return { kind: 'material', material: decodeFogMaterial({ density: '1' }), densityTexture };
}

const FOG_MATERIAL = fogMaterial();

function volume(
  position: [number, number, number],
  fill: FogVolumeFill = FOG_MATERIAL,
  shape: number = FogVolumeShape.BOX
): FogVolumeObject {
  const object = new FogVolumeObject();
  object.position.set(...position);
  object.size.set(3, 3, 3);
  object.shape = shape;
  object.fill = fill;
  object.updateMatrixWorld();
  return object;
}

/** The texel `texel` of row `row`. */
function texel(rows: FogVolumeRows, texel: number, row = 0): number[] {
  const start = (row * FOG_VOLUME_TEXELS + texel) * 4;
  return Array.from(rows.data.subarray(start, start + 4));
}

describe('FogVolumeRows.pack', () => {
  it('packs a FogMaterial box: its density, height falloff, edge fade and kind', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5])], camera(), FRAME, ATLAS);
    expect(rows.count).toBe(1);
    expect(texel(rows, FogVolumeTexel.MATERIAL)).toEqual([1, 0, Math.fround(0.1), 1]);
  });

  it('maps the view origin, the camera, to its offset from the volume in local space', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5])], camera(), FRAME, ATLAS);
    const translation = [0, 1, 2].map((axis) => texel(rows, FogVolumeTexel.TO_LOCAL + axis)[3]);
    expect(translation).toEqual([0, 2, 13]);
  });

  it('measures the camera 2 units above the volume origin through the height row', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5])], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.HEIGHT)[3]).toBe(2);
  });

  it('writes the albedo and the emission as linear colours', () => {
    const fill: FogVolumeFill = {
      kind: 'material',
      material: decodeFogMaterial({ albedo: 'Color(0.5, 1, 0, 1)', emission: 'Color(0, 0, 0.5, 1)' }),
      densityTexture: null,
    };
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5], fill)], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.ALBEDO).slice(0, 3)).toEqual([Math.fround(0.21404114), 1, 0]);
    expect(texel(rows, FogVolumeTexel.EMISSION)[2]).toBeCloseTo(0.21404114, 6);
  });

  it("packs Godot's default fog material for a volume without a material", () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5], { kind: 'default' })], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.MATERIAL)[3]).toBe(0);
  });

  it('skips a volume filled by a fog shader, which the previewer does not run', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5], { kind: 'shader' })], camera(), FRAME, ATLAS);
    expect(rows.count).toBe(0);
  });

  it('skips a hidden volume', () => {
    const hidden = volume([0, 1, -5]);
    hidden.visible = false;
    const rows = new FogVolumeRows();
    rows.pack([hidden], camera(), FRAME, ATLAS);
    expect(rows.count).toBe(0);
  });

  it("skips a local volume outside the camera's frustum, as Godot's culling does", () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, 20])], camera(), FRAME, ATLAS);
    expect(rows.count).toBe(0);
  });

  it('covers the whole screen up to the farthest corner when the camera is in the volume', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 3, 8])], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.FROXEL_MIN).slice(0, 3)).toEqual([0, 0, 0]);
    expect(texel(rows, FogVolumeTexel.FROXEL_MAX).slice(0, 2)).toEqual([71, 56]);
  });

  it('covers every froxel with a WORLD volume, sized twice the grid, wherever it is (edge case)', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, 20], FOG_MATERIAL, FogVolumeShape.WORLD)], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.SHAPE)).toEqual([142, 112, 128, FogVolumeShape.WORLD]);
    expect(texel(rows, FogVolumeTexel.FROXEL_MAX).slice(0, 3)).toEqual([71, 56, 64]);
  });

  it("writes the density texture's region in the atlas", () => {
    const densityTexture = new THREE.Data3DTexture(new Uint8Array(4 * 3 * 2), 4, 3, 2);
    const atlas = new FogDensityAtlas();
    atlas.update([new THREE.Data3DTexture(new Uint8Array(1), 1, 1, 1), densityTexture]);
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5], fogMaterial(densityTexture))], camera(), FRAME, atlas);
    expect(texel(rows, FogVolumeTexel.DENSITY_TEXTURE)).toEqual([4, 3, 2, 1]);
  });

  it('writes no region for a FogMaterial without a density texture, which samples as white', () => {
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5])], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.DENSITY_TEXTURE)).toEqual([0, 0, 0, 0]);
  });

  it('writes no region for a density texture the atlas left out (edge case)', () => {
    const densityTexture = new THREE.Data3DTexture(new Uint8Array(1), 1, 1, 1);
    const rows = new FogVolumeRows();
    rows.pack([volume([0, 1, -5], fogMaterial(densityTexture))], camera(), FRAME, ATLAS);
    expect(texel(rows, FogVolumeTexel.DENSITY_TEXTURE)).toEqual([0, 0, 0, 0]);
  });

  it('answers that nothing changed when the volumes and the camera hold still', () => {
    const rows = new FogVolumeRows();
    const volumes = [volume([0, 1, -5])];
    rows.pack(volumes, camera(), FRAME, ATLAS);
    expect(rows.pack(volumes, camera(), FRAME, ATLAS)).toBe(false);
  });

  it('answers that a row changed when a volume moves', () => {
    const rows = new FogVolumeRows();
    const moving = volume([0, 1, -5]);
    rows.pack([moving], camera(), FRAME, ATLAS);
    moving.position.x = 1;
    moving.updateMatrixWorld();
    expect(rows.pack([moving], camera(), FRAME, ATLAS)).toBe(true);
  });
});
