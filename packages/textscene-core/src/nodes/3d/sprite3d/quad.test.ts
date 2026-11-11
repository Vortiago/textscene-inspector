import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  spriteQuadAabb,
  spriteQuadGeometry,
  spriteQuadRect,
  writeSpriteQuadColour,
  writeSpriteQuadUvs,
} from './quad';
import { Vector3Axis } from '../../../godot/math/vector3Axis';
import { BillboardMode } from '../../../godot/rendering/materials/billboardMode';

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
    expect(corners(spriteQuadGeometry(rect, Vector3Axis.Z))).toEqual([
      [0, 0, 0],
      [2, 1, 0],
    ]);
  });

  it('lays the quad on the XZ plane for AXIS_Y, with its 2D up towards -Z', () => {
    expect(corners(spriteQuadGeometry(rect, Vector3Axis.Y))).toEqual([
      [0, 0, -1],
      [2, 0, 0],
    ]);
  });

  it('lays the quad on the ZY plane for AXIS_X, with its 2D right towards -Z', () => {
    expect(corners(spriteQuadGeometry(rect, Vector3Axis.X))).toEqual([
      [0, 0, -2],
      [0, 1, 0],
    ]);
  });

  it('faces the normal along the axis', () => {
    const geometry = spriteQuadGeometry(rect, Vector3Axis.Y);
    const normal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), 0);
    expect(normal.toArray().map((v) => Math.round(v) + 0)).toEqual([0, 1, 0]);
  });
});

describe('writeSpriteQuadUvs', () => {
  const rect = spriteQuadRect(SIZE, { centered: true, offset: { x: 0, y: 0 }, pixel_size: 0.01 });

  /** Each vertex's position on the sprite plane with the UV it holds. */
  function uvAtCorners(geometry: THREE.BufferGeometry): Record<string, number[]> {
    const positions = geometry.getAttribute('position');
    const uvs = geometry.getAttribute('uv');
    return Object.fromEntries(
      [0, 1, 2, 3].map((vertex) => [
        `${positions.getX(vertex) < 0 ? 'left' : 'right'}-${positions.getY(vertex) < 0 ? 'bottom' : 'top'}`,
        [uvs.getX(vertex), uvs.getY(vertex)],
      ])
    );
  }

  it('spreads the window over the quad, its offset at the bottom-left corner', () => {
    const geometry = spriteQuadGeometry(rect, Vector3Axis.Z);
    writeSpriteQuadUvs(geometry, { offset: { x: 0.25, y: 0.5 }, repeat: { x: 0.25, y: 0.5 } });
    expect(uvAtCorners(geometry)).toEqual({
      'left-top': [0.25, 1],
      'right-top': [0.5, 1],
      'left-bottom': [0.25, 0.5],
      'right-bottom': [0.5, 0.5],
    });
  });

  it('sweeps a flipped window from its far edge', () => {
    const geometry = spriteQuadGeometry(rect, Vector3Axis.Z);
    writeSpriteQuadUvs(geometry, { offset: { x: 1, y: 0 }, repeat: { x: -1, y: 1 } });
    expect(uvAtCorners(geometry)['left-bottom']).toEqual([1, 0]);
    expect(uvAtCorners(geometry)['right-bottom']).toEqual([0, 0]);
  });

  it('marks the attribute for upload, so a frame change on a drawn quad shows', () => {
    const geometry = spriteQuadGeometry(rect, Vector3Axis.Z);
    const uvs = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const before = uvs.version;
    writeSpriteQuadUvs(geometry, { offset: { x: 0, y: 0 }, repeat: { x: 1, y: 1 } });
    expect(uvs.version).toBe(before + 1);
  });
});

describe('writeSpriteQuadColour', () => {
  const rect = spriteQuadRect(SIZE, { centered: true, offset: { x: 0, y: 0 }, pixel_size: 0.01 });

  it('gives every vertex the modulate, cut to eight bits and never rounded', () => {
    const geometry = spriteQuadGeometry(rect, Vector3Axis.Z);
    writeSpriteQuadColour(geometry, { r: 0.2, g: 1, b: 0.5, a: 0.999 });
    const colours = geometry.getAttribute('color');
    expect([colours.count, colours.itemSize, colours.normalized]).toEqual([4, 4, true]);
    expect(Array.from(colours.array)).toEqual(Array(4).fill([51, 255, 127, 254]).flat());
  });

  it('clamps an overbright or negative channel to the byte range', () => {
    const geometry = spriteQuadGeometry(rect, Vector3Axis.Z);
    writeSpriteQuadColour(geometry, { r: 2, g: -1, b: 0, a: 1 });
    expect(Array.from(geometry.getAttribute('color').array.slice(0, 4))).toEqual([255, 0, 0, 255]);
  });
});

describe('spriteQuadAabb', () => {
  const rect = spriteQuadRect(SIZE, { centered: false, offset: { x: 0, y: 0 }, pixel_size: 0.01 });

  it('is the quad itself with no billboard', () => {
    expect(spriteQuadAabb(rect, Vector3Axis.Y, BillboardMode.BILLBOARD_DISABLED)).toEqual({
      position: { x: 0, y: 0, z: -1 },
      size: { x: 2, y: 0, z: 1 },
    });
  });

  it('grows to the cube a billboard can turn through', () => {
    expect(spriteQuadAabb(rect, Vector3Axis.Z, BillboardMode.BILLBOARD_ENABLED).size).toEqual({
      x: 4,
      y: 4,
      z: 4,
    });
  });
});
