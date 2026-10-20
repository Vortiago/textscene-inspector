import { describe, expect, it } from 'vitest';
import { PLANE_MESH_ORIENTATION_NAMES, PlaneMeshOrientation } from './planeMesh.js';

describe('PLANE_MESH_ORIENTATION_NAMES', () => {
  it('names the three facings by their constants (primitive_meshes.h:245-249, 4.7.2 :246-250)', () => {
    expect(PLANE_MESH_ORIENTATION_NAMES).toEqual({ 0: 'FACE_X', 1: 'FACE_Y', 2: 'FACE_Z' });
  });

  it('keeps the integers the enum stores', () => {
    expect(PlaneMeshOrientation.FACE_Z).toBe(2);
  });
});
