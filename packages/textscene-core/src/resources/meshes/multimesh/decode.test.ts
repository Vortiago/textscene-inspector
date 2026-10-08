import { describe, expect, it } from 'vitest';
import { decodeMultiMesh } from './decode';

const MESH = 'SubResource("BoxMesh_1")';

/** A 3D buffer row set: the basis rows, each followed by its origin component. */
function translation3D(x: number, y: number, z: number): number[] {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

function buffer(values: number[]): string {
  return `PackedFloat32Array(${values.join(', ')})`;
}

function bounded(properties: Record<string, string>): number[] {
  return [...decodeMultiMesh(properties).boundedTransforms];
}

describe('decodeMultiMesh: the buffer', () => {
  it('bounds every instance of a 3D buffer, in Godot’s saved order', () => {
    const transforms = [...translation3D(1, 2, 3), ...translation3D(-4, 0, 0)];
    const properties = {
      transform_format: '1',
      instance_count: '2',
      mesh: MESH,
      buffer: buffer(transforms),
    };
    expect(bounded(properties)).toEqual(transforms);
  });

  it('reads a 2D buffer’s rows 0 and 1 into an identity transform', () => {
    const properties = { instance_count: '1', mesh: MESH, buffer: buffer([2, 3, 0, 5, 7, 11, 0, 13]) };
    expect(bounded(properties)).toEqual([2, 3, 0, 5, 7, 11, 0, 13, 0, 0, 1, 0]);
  });

  it('steps over each instance’s colour and custom data', () => {
    const properties = {
      transform_format: '1',
      use_colors: 'true',
      use_custom_data: 'true',
      instance_count: '1',
      mesh: MESH,
      buffer: buffer([...translation3D(1, 1, 1), 0.1, 0.2, 0.3, 1, 9, 9, 9, 9]),
    };
    expect(bounded(properties)).toEqual(translation3D(1, 1, 1));
  });

  it('bounds every instance, not only the visible ones, with no CPU copy', () => {
    const transforms = [...translation3D(0, 0, 0), ...translation3D(5, 0, 0)];
    const properties = {
      transform_format: '1',
      instance_count: '2',
      visible_instance_count: '1',
      mesh: MESH,
      buffer: buffer(transforms),
    };
    expect(bounded(properties)).toEqual(transforms);
  });

  it('bounds the buffer when the mesh comes after it', () => {
    const properties = {
      transform_format: '1',
      instance_count: '1',
      buffer: buffer(translation3D(1, 0, 0)),
      mesh: MESH,
    };
    expect(bounded(properties)).toEqual(translation3D(1, 0, 0));
  });

  it('ignores a buffer whose size is not the instances times the stride', () => {
    const properties = {
      transform_format: '1',
      instance_count: '2',
      mesh: MESH,
      buffer: buffer(translation3D(1, 0, 0)),
    };
    expect(bounded(properties)).toEqual([]);
  });

  it('throws on a buffer it cannot read', () => {
    const properties = { instance_count: '1', mesh: MESH, buffer: 'PackedFloat32Array(1, x)' };
    expect(() => decodeMultiMesh(properties)).toThrow('Invalid number in PackedFloat32Array');
  });
});

describe('decodeMultiMesh: property order', () => {
  it('keeps the 2D format when transform_format comes after instance_count', () => {
    const properties = {
      instance_count: '1',
      transform_format: '1',
      mesh: MESH,
      buffer: buffer(translation3D(1, 0, 0)),
    };
    expect(bounded(properties)).toEqual([]);
  });

  it('drops the buffer when instance_count comes after it', () => {
    const properties = {
      transform_format: '1',
      mesh: MESH,
      buffer: buffer(translation3D(1, 0, 0)),
      instance_count: '1',
    };
    expect(bounded(properties)).toEqual([]);
  });
});

describe('decodeMultiMesh: the 3.x arrays', () => {
  it('bounds a transform_array through the CPU copy, as far as the visible count', () => {
    const properties = {
      transform_format: '1',
      instance_count: '2',
      visible_instance_count: '1',
      mesh: MESH,
      transform_array:
        'PackedVector3Array(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4, 5, 1, 0, 0, 0, 1, 0, 0, 0, 1, 9, 9, 9)',
    };
    expect(bounded(properties)).toEqual(translation3D(3, 4, 5));
  });

  it('reads a transform_2d_array’s columns into the buffer rows', () => {
    const properties = {
      instance_count: '1',
      mesh: MESH,
      transform_2d_array: 'PackedVector2Array(2, 3, 5, 7, 11, 13)',
    };
    expect(bounded(properties)).toEqual([2, 5, 0, 11, 3, 7, 0, 13, 0, 0, 1, 0]);
  });

  it('routes a later buffer through the CPU copy a color_array made, so the visible count applies', () => {
    const transforms = [...translation3D(0, 0, 0), 1, 1, 1, 1, ...translation3D(5, 0, 0), 1, 1, 1, 1];
    const properties = {
      transform_format: '1',
      use_colors: 'true',
      instance_count: '2',
      visible_instance_count: '1',
      mesh: MESH,
      color_array: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 1)',
      buffer: buffer(transforms),
    };
    expect(bounded(properties)).toEqual(translation3D(0, 0, 0));
  });

  it('refuses a transform_array on a 2D MultiMesh', () => {
    const properties = {
      instance_count: '1',
      mesh: MESH,
      transform_array: 'PackedVector3Array(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4, 5)',
    };
    expect(bounded(properties)).toEqual([]);
  });
});

describe('decodeMultiMesh: mesh and custom box', () => {
  it('bounds nothing with no mesh, and names none', () => {
    const properties = { transform_format: '1', instance_count: '1', buffer: buffer(translation3D(1, 0, 0)) };
    expect(decodeMultiMesh(properties)).toMatchObject({
      mesh: undefined,
      boundedTransforms: new Float32Array(0),
    });
  });

  it('takes a null mesh as none', () => {
    const properties = {
      transform_format: '1',
      instance_count: '1',
      mesh: 'null',
      buffer: buffer(translation3D(1, 0, 0)),
    };
    expect(decodeMultiMesh(properties).mesh).toBeUndefined();
  });

  it('keeps a custom box and bounds nothing under it', () => {
    const properties = {
      transform_format: '1',
      custom_aabb: 'AABB(-1, -1, -1, 2, 2, 2)',
      instance_count: '1',
      mesh: MESH,
      buffer: buffer(translation3D(1, 0, 0)),
    };
    expect(decodeMultiMesh(properties)).toMatchObject({
      customAabb: { position: { x: -1, y: -1, z: -1 }, size: { x: 2, y: 2, z: 2 } },
      boundedTransforms: new Float32Array(0),
    });
  });

  it('takes a custom AABB() as none', () => {
    expect(decodeMultiMesh({ custom_aabb: 'AABB(0, 0, 0, 0, 0, 0)' }).customAabb).toBeNull();
  });
});
