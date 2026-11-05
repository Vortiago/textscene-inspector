/** decodeMultiMesh: the instances a MultiMesh draws, with each one's transform, colour and custom data. */

import { describe, expect, it } from 'vitest';
import { MultiMeshTransformFormat } from '../../../godot/scene/multiMesh';
import { decodeMultiMesh } from './decode';

const MESH = 'SubResource("QuadMesh_1")';

function buffer(values: number[]): string {
  return `PackedFloat32Array(${values.join(', ')})`;
}

/** A 2D buffer transform at (x, y): `[xx, xy, 0, ox, yx, yy, 0, oy]` (`mesh_storage.cpp:1927-1934`). */
function at2D(x: number, y: number): number[] {
  return [1, 0, 0, x, 0, 1, 0, y];
}

function drawn(properties: Record<string, string>) {
  return decodeMultiMesh(properties).instances.map((instance) => ({
    transform: [...instance.transform],
    color: instance.color && [...instance.color],
    customData: instance.customData && [...instance.customData],
  }));
}

describe('decodeMultiMesh: the instances to draw', () => {
  it('reads each 2D transform from a buffer, in instance order', () => {
    const properties = {
      instance_count: '2',
      mesh: MESH,
      buffer: buffer([...at2D(5, 6), 0, -1, 0, 50, 1, 0, 0, 60]),
    };
    expect(drawn(properties)).toEqual([
      { transform: at2D(5, 6), color: null, customData: null },
      { transform: [0, -1, 0, 50, 1, 0, 0, 60], color: null, customData: null },
    ]);
  });

  it('names the transform format', () => {
    expect(decodeMultiMesh({ instance_count: '1', buffer: buffer(at2D(0, 0)) }).transformFormat).toBe(
      MultiMeshTransformFormat.TRANSFORM_2D
    );
    expect(decodeMultiMesh({ transform_format: '1' }).transformFormat).toBe(
      MultiMeshTransformFormat.TRANSFORM_3D
    );
  });

  it('reads the colour and custom data after the transform', () => {
    const properties = {
      use_colors: 'true',
      use_custom_data: 'true',
      instance_count: '1',
      mesh: MESH,
      buffer: buffer([...at2D(1, 2), 0.25, 0.5, 0.75, 1, 0, 0, 0.5, 0]),
    };
    expect(drawn(properties)).toEqual([
      { transform: at2D(1, 2), color: [0.25, 0.5, 0.75, 1], customData: [0, 0, 0.5, 0] },
    ]);
  });

  it('reads custom data from the slot after the transform when there are no colours', () => {
    const properties = {
      use_custom_data: 'true',
      instance_count: '1',
      buffer: buffer([...at2D(0, 0), 9, 8, 7, 6]),
    };
    expect(drawn(properties)[0]!.customData).toEqual([9, 8, 7, 6]);
    expect(drawn(properties)[0]!.color).toBeNull();
  });

  it('stops at visible_instance_count', () => {
    const properties = {
      instance_count: '3',
      visible_instance_count: '2',
      buffer: buffer([...at2D(1, 0), ...at2D(2, 0), ...at2D(3, 0)]),
    };
    expect(drawn(properties).map((instance) => instance.transform[3])).toEqual([1, 2]);
  });

  it('draws every instance for a visible count of -1, and none for 0', () => {
    const base = { instance_count: '2', buffer: buffer([...at2D(1, 0), ...at2D(2, 0)]) };
    expect(drawn({ ...base, visible_instance_count: '-1' })).toHaveLength(2);
    expect(drawn({ ...base, visible_instance_count: '0' })).toHaveLength(0);
  });

  it('gives an allocated instance with no data a zero transform', () => {
    expect(drawn({ instance_count: '1' })[0]!.transform).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('reads the 3.x transform_2d_array, color_array and custom_data_array', () => {
    const properties = {
      use_colors: 'true',
      use_custom_data: 'true',
      instance_count: '1',
      transform_2d_array: 'PackedVector2Array(2, 3, 5, 7, 11, 13)',
      color_array: 'PackedColorArray(1, 0, 0, 1)',
      custom_data_array: 'PackedColorArray(0, 0, 0.5, 0)',
    };
    expect(drawn(properties)).toEqual([
      { transform: [2, 5, 0, 11, 3, 7, 0, 13], color: [1, 0, 0, 1], customData: [0, 0, 0.5, 0] },
    ]);
  });

  it('reads a 3D buffer as 12 floats of transform', () => {
    const transform = [1, 0, 0, 4, 0, 1, 0, 5, 0, 0, 1, 6];
    const properties = { transform_format: '1', instance_count: '1', buffer: buffer(transform) };
    expect(drawn(properties)[0]!.transform).toEqual(transform);
  });
});
