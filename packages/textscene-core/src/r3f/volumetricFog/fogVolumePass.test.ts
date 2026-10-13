import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VOLUMETRIC_FOG_TEMPORAL_JITTERS } from '../../godot/volumetricFog';
import { acquireFogVolumePass, fogProjection, froxelSampleOffsets } from './fogVolumePass';

describe('froxelSampleOffsets', () => {
  it('samples the cell centre without temporal reprojection', () => {
    expect(froxelSampleOffsets(false)).toEqual([new THREE.Vector3(0.5, 0.5, 0.5)]);
  });

  it('samples each of Godot’s 16 jitters under temporal reprojection', () => {
    expect(froxelSampleOffsets(true)).toHaveLength(16);
  });

  it('flips a jitter’s top-down y into the volume’s bottom-up rows (edge case)', () => {
    const [x, y, z] = VOLUMETRIC_FOG_TEMPORAL_JITTERS[1]!;
    const offset = froxelSampleOffsets(true)[1]!;

    expect(offset.x).toBe(x);
    expect(offset.y).toBeCloseTo(1 - y, 8);
    expect(offset.z).toBe(z);
  });
});

describe('fogProjection', () => {
  it('reads a perspective camera’s near and far sections', () => {
    const camera = new THREE.PerspectiveCamera(90, 2, 1, 100);

    const projection = fogProjection(camera);

    expect(projection.near).toBeCloseTo(1, 6);
    expect(projection.far).toBeCloseTo(100, 4);
    expect(projection.nearHalfExtents.x).toBeCloseTo(2, 6);
    expect(projection.nearHalfExtents.y).toBeCloseTo(1, 6);
    expect(projection.farHalfExtents.y).toBeCloseTo(100, 3);
    expect(projection.isOrthographic).toBe(false);
  });

  it('reads one section at both ends of an orthographic camera', () => {
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.5, 50);

    const projection = fogProjection(camera);

    expect(projection.nearHalfExtents.x).toBeCloseTo(3, 6);
    expect(projection.farHalfExtents.y).toBeCloseTo(2, 6);
    expect(projection.isOrthographic).toBe(true);
  });
});

describe('acquireFogVolumePass', () => {
  const renderer = () => ({}) as THREE.WebGLRenderer;

  it('shares one pass between the users of a renderer', () => {
    const gl = renderer();
    const first = acquireFogVolumePass(gl);
    const second = acquireFogVolumePass(gl);

    expect(second.pass).toBe(first.pass);
  });

  it('gives another renderer its own pass', () => {
    expect(acquireFogVolumePass(renderer()).pass).not.toBe(acquireFogVolumePass(renderer()).pass);
  });

  it('keeps the pass while another user holds it, counting a repeated release once', () => {
    const gl = renderer();
    const first = acquireFogVolumePass(gl);
    acquireFogVolumePass(gl);

    first.release();
    first.release();
    expect(acquireFogVolumePass(gl).pass).toBe(first.pass);
  });

  it('builds a new pass once every user has released (edge case)', () => {
    const gl = renderer();
    const only = acquireFogVolumePass(gl);
    only.release();

    expect(acquireFogVolumePass(gl).pass).not.toBe(only.pass);
  });
});
