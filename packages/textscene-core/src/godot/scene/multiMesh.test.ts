import { describe, expect, it } from 'vitest';
import {
  MULTI_MESH_PHYSICS_INTERPOLATION_QUALITY_NAMES,
  MULTI_MESH_TRANSFORM_FORMAT_NAMES,
  MultiMeshTransformFormat,
} from './multiMesh.js';

describe('MULTI_MESH_TRANSFORM_FORMAT_NAMES', () => {
  it('names the two formats by their constants (multimesh.h:41-44)', () => {
    expect(MULTI_MESH_TRANSFORM_FORMAT_NAMES).toEqual({ 0: 'TRANSFORM_2D', 1: 'TRANSFORM_3D' });
  });

  it('keeps the integers the enum stores', () => {
    expect(MultiMeshTransformFormat.TRANSFORM_3D).toBe(1);
  });
});

describe('MULTI_MESH_PHYSICS_INTERPOLATION_QUALITY_NAMES', () => {
  it('names the two qualities without INTERP_QUALITY_ (multimesh.h:46-49)', () => {
    expect(MULTI_MESH_PHYSICS_INTERPOLATION_QUALITY_NAMES).toEqual({ 0: 'FAST', 1: 'HIGH' });
  });
});
