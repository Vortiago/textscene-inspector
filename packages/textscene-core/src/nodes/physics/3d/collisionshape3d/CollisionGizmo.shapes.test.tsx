/**
 * Every Godot primitive Shape3D draws the lines of its `get_debug_mesh_lines()`, not a three.js
 * mesh and not a 1x1x1 box. The expected counts and vertices were read from Godot 4.6.3
 * `get_debug_mesh()` for the same shapes.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionGizmo } from './CollisionGizmo';
import type { TscnInternalResource } from '../../../../parser/types';
import { linePositions } from '../../../../r3f/testing/GizmoScene';
import { findMesh } from '../../../3d/testing/reactThreeTestInstance';

/** The flat segment ends of the gizmo's lines, and how many meshes it drew beside them. */
async function drawn(shape: TscnInternalResource) {
  const renderer = await ReactThreeTestRenderer.create(
    <CollisionGizmo shape={shape} color={new THREE.Color(0x00ff88)} />
  );
  return { positions: linePositions(renderer), meshCount: renderer.scene.findAllByType('Mesh').length };
}

const VERTEX_FLOATS = 3;

function shape(type: string, data: Record<string, string> = {}): TscnInternalResource {
  return { id: `${type}_1`, type, data };
}

describe('<CollisionGizmo> primitive shapes', () => {
  it('draws a BoxShape3D as its 12 edges', async () => {
    const { positions, meshCount } = await drawn(shape('BoxShape3D', { size: 'Vector3(2, 3, 4)' }));
    expect(positions.length / VERTEX_FLOATS).toBe(24);
    expect(Array.from(positions.slice(0, 3))).toEqual([1, -1.5, -2]);
    expect(meshCount).toBe(0);
  });

  it('draws a SphereShape3D as three great circles', async () => {
    const { positions } = await drawn(shape('SphereShape3D', { radius: '2' }));
    expect(positions.length / VERTEX_FLOATS).toBe(2166);
    expect(Array.from(positions.slice(0, 3))).toEqual([0, 0, 2]);
  });

  it('draws a CylinderShape3D as two rings and four ticks', async () => {
    const { positions } = await drawn(shape('CylinderShape3D', { radius: '0.75', height: '3' }));
    expect(positions.length / VERTEX_FLOATS).toBe(1448);
    expect(Array.from(positions.slice(0, 3))).toEqual([0, 1.5, 0.75]);
  });

  it('draws a CapsuleShape3D at its authored radius and full height', async () => {
    const { positions } = await drawn(shape('CapsuleShape3D', { radius: '0.4', height: '1.8' }));
    expect(positions.length / VERTEX_FLOATS).toBe(2888);
    expect(Array.from(positions.slice(0, 3))).toEqual([0, expect.closeTo(0.5, 6), expect.closeTo(0.4, 6)]);
  });

  it('clamps a too-short capsule as Godot does: height stands, radius drops to half of it', async () => {
    // Godot 4.6.3: radius 1 then height 0.5 leaves radius 0.25, so the rings are 0.25 wide.
    const { positions } = await drawn(shape('CapsuleShape3D', { radius: '1', height: '0.5' }));
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(Math.max(...Array.from(positions, Math.abs))).toBeCloseTo(0.25, 5);
  });

  it('draws a WorldBoundaryShape3D as the square and normal ray Godot draws, not a box', async () => {
    const { positions, meshCount } = await drawn(
      shape('WorldBoundaryShape3D', { plane: 'Plane(1, 0, 0, 2.5)' })
    );
    expect(Array.from(positions)).toEqual([
      2.5, 10, 10, 2.5, 10, -10, 2.5, 10, -10, 2.5, -10, -10, 2.5, -10, -10, 2.5, -10, 10, 2.5, -10, 10, 2.5,
      10, 10, 2.5, 0, 0, 5.5, 0, 0,
    ]);
    expect(meshCount).toBe(0);
  });

  it('still falls back to a unit box for a genuinely unknown shape type', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CollisionGizmo shape={shape('SeparationRayShape3D')} color={new THREE.Color(0x00ff88)} />
    );
    expect((findMesh(renderer.scene).geometry as THREE.BufferGeometry).type).toBe('BoxGeometry');
  });
});
