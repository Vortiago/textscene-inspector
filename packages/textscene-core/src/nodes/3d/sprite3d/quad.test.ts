import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { spriteQuadAabb, spriteQuadGeometry, spriteQuadRect } from './quad';
import { AxisMode } from './types';
import { BillboardMode } from '../../../godot/billboard';

const SIZE = { width: 2, height: 1 };

/** The geometry's box corners, rounded off the float error a rotation leaves. */
function corners(geometry: THREE.BufferGeometry): number[][] {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  return [min, max].map((corner) => corner.toArray().map((v) => Math.round(v * 1e6) / 1e6 + 0));
}

describe('spriteQuadRect', () => {
  it('centres the rect on the origin when centered', () => {
    const rect = spriteQuadRect(SIZE, { centered: true, offset: { x: 0, y: 0 }, pixel_size: 0.01 });
    expect(rect).toEqual({ position: { x: -1, y: -0.5, z: 0 }, size: { x: 2, y: 1, z: 0 } });
  });

  it('puts the bottom-left corner on the origin when not centered', () => {
    // Godot flips the 2D rect's Y onto the 3D plane, so its top-left lands bottom-left.
    const rect = spriteQuadRect(SIZE, { centered: false, offset: { x: 0, y: 0 }, pixel_size: 0.01 });
    expect(rect.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('moves the rect up by a positive offset.y, in pixels', () => {
    const rect = spriteQuadRect(SIZE, { centered: false, offset: { x: 10, y: 32 }, pixel_size: 0.01 });
    expect(rect.position).toEqual({ x: 0.1, y: 0.32, z: 0 });
  });
});

describe('spriteQuadGeometry', () => {
  const rect = spriteQuadRect(SIZE, { centered: false, offset: { x: 0, y: 0 }, pixel_size: 0.01 });

  it('lays the quad on the XY plane for AXIS_Z', () => {
    expect(corners(spriteQuadGeometry(rect, AxisMode.AXIS_Z))).toEqual([
      [0, 0, 0],
      [2, 1, 0],
    ]);
  });

  it('lays the quad on the XZ plane for AXIS_Y, with its 2D up towards -Z', () => {
    expect(corners(spriteQuadGeometry(rect, AxisMode.AXIS_Y))).toEqual([
      [0, 0, -1],
      [2, 0, 0],
    ]);
  });

  it('lays the quad on the ZY plane for AXIS_X, with its 2D right towards -Z', () => {
    expect(corners(spriteQuadGeometry(rect, AxisMode.AXIS_X))).toEqual([
      [0, 0, -2],
      [0, 1, 0],
    ]);
  });

  it('faces the normal along the axis', () => {
    const geometry = spriteQuadGeometry(rect, AxisMode.AXIS_Y);
    const normal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), 0);
    expect(normal.toArray().map((v) => Math.round(v) + 0)).toEqual([0, 1, 0]);
  });
});

describe('spriteQuadAabb', () => {
  const rect = spriteQuadRect(SIZE, { centered: false, offset: { x: 0, y: 0 }, pixel_size: 0.01 });

  it('is the quad itself with no billboard', () => {
    expect(spriteQuadAabb(rect, AxisMode.AXIS_Y, BillboardMode.BILLBOARD_DISABLED)).toEqual({
      position: { x: 0, y: 0, z: -1 },
      size: { x: 2, y: 0, z: 1 },
    });
  });

  it('grows to the cube a billboard can turn through', () => {
    expect(spriteQuadAabb(rect, AxisMode.AXIS_Z, BillboardMode.BILLBOARD_ENABLED).size).toEqual({
      x: 4,
      y: 4,
      z: 4,
    });
  });
});
