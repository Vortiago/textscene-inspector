/**
 * The camera UI's type test is Godot's class tree, so a subclass the renderer
 * already treats as a camera is offered as one.
 */
import { describe, expect, it } from 'vitest';
import { isCamera2DType, isCamera3DType } from './cameraNodeTypes';

describe('isCamera3DType', () => {
  it('accepts Camera3D itself', () => {
    expect(isCamera3DType('Camera3D')).toBe(true);
  });

  it('accepts a subclass the renderer mounts Camera3D for', () => {
    expect(isCamera3DType('XRCamera3D')).toBe(true);
  });

  it('rejects the other camera kind and a plain spatial node', () => {
    expect(isCamera3DType('Camera2D')).toBe(false);
    expect(isCamera3DType('Node3D')).toBe(false);
  });

  it('rejects a type Godot does not know', () => {
    expect(isCamera3DType('TotallyUnknownType')).toBe(false);
  });
});

describe('isCamera2DType', () => {
  it('accepts Camera2D itself', () => {
    expect(isCamera2DType('Camera2D')).toBe(true);
  });

  it('rejects Camera3D and its subclasses', () => {
    expect(isCamera2DType('Camera3D')).toBe(false);
    expect(isCamera2DType('XRCamera3D')).toBe(false);
  });

  it('rejects a type Godot does not know', () => {
    expect(isCamera2DType('TotallyUnknownType')).toBe(false);
  });
});
