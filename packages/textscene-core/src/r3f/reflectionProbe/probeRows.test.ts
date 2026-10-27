import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ReflectionProbeAmbientMode } from '../../godot/rendering/environment/reflectionProbe';
import { PROBE_ROW_TEXELS, probeRows, type DrawnProbe } from './probeRows';

const PROBE: DrawnProbe = {
  worldToLocal: new THREE.Matrix4().makeTranslation(-1, -2, -3),
  size: { x: 4, y: 6, z: 8 },
  blendDistance: 2,
  originOffset: { x: 0.5, y: 0, z: -0.5 },
  intensity: 0.75,
  ambientMode: ReflectionProbeAmbientMode.COLOR,
  ambientColor: { r: 1, g: 0.5, b: 0, a: 1 },
  ambientColorEnergy: 2,
  reflectionMask: 0xffff_ffff,
  boxProjection: true,
  atlasLayer: 3,
  exposureNormalization: 0.5,
};

/** Texel `texel` of probe `index` in `rows`. */
function texel(rows: Float32Array, index: number, texel: number): number[] {
  const start = (index * PROBE_ROW_TEXELS + texel) * 4;
  return Array.from(rows.subarray(start, start + 4));
}

describe('probeRows', () => {
  it("packs the world-to-local matrix's three rows first", () => {
    const rows = probeRows([PROBE]);

    expect([texel(rows, 0, 0), texel(rows, 0, 1), texel(rows, 0, 2)]).toEqual([
      [1, 0, 0, -1],
      [0, 1, 0, -2],
      [0, 0, 1, -3],
    ]);
  });

  it('packs the half size with the blend distance, and the origin offset with the intensity', () => {
    const rows = probeRows([PROBE]);

    expect([texel(rows, 0, 3), texel(rows, 0, 4)]).toEqual([
      [2, 3, 4, 2],
      [0.5, 0, -0.5, 0.75],
    ]);
  });

  it('packs the ambient colour in linear times its energy, with the ambient mode', () => {
    const [r, g, b, mode] = texel(probeRows([PROBE]), 0, 5);

    expect([r, b, mode]).toEqual([2, 0, ReflectionProbeAmbientMode.COLOR]);
    expect(g).toBeCloseTo(0.2140411 * 2, 6);
  });

  it('splits the 32-bit mask into two halves a float holds exactly, with the box projection and the layer', () => {
    expect(texel(probeRows([PROBE]), 0, 6)).toEqual([0xffff, 0xffff, 1, 3]);
  });

  it('packs the exposure normalisation in its own texel after the mask (light_storage.cpp:1810-1814)', () => {
    expect(texel(probeRows([PROBE]), 0, 7)).toEqual([0.5, 0, 0, 0]);
  });

  it('packs each probe after the one before', () => {
    const second = { ...PROBE, atlasLayer: 7, boxProjection: false, reflectionMask: 0x1_0002 };

    expect(texel(probeRows([PROBE, second]), 1, 6)).toEqual([2, 1, 0, 7]);
  });

  it('holds one empty probe for none, as a texture needs a texel (edge case)', () => {
    expect(probeRows([])).toEqual(new Float32Array(PROBE_ROW_TEXELS * 4));
  });
});
