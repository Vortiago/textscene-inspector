/**
 * Every Godot primitive Shape3D draws its own geometry.
 *
 * Capsule, sphere and cylinder shapes used to fall through to a 1x1x1
 * wireframe box — wrong shape AND wrong size. The player capsule in
 * scenes/demos/3d/platformer/player/player.tscn is one of them, and the only
 * gizmo-bearing golden carries the one shape type that WAS implemented, so
 * nothing could see it.
 *
 * Sizes come from the class reference: CapsuleShape3D radius 0.5 / height 2.0
 * (full height, hemispheres included), SphereShape3D radius 0.5,
 * CylinderShape3D radius 0.5 / height 2.0 — all Y-axis aligned.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionGizmo } from './CollisionGizmo';
import type { TscnInternalResource } from '../../../../parser/types';
import { findMesh } from '../../../3d/testing/reactThreeTestInstance';

async function geometryOf(shape: TscnInternalResource) {
  const renderer = await ReactThreeTestRenderer.create(
    <CollisionGizmo shape={shape} color={new THREE.Color(0x00ff88)} />
  );
  return findMesh(renderer.scene).geometry as unknown as {
    type: string;
    parameters: Record<string, number>;
  };
}

function shape(type: string, data: Record<string, string> = {}): TscnInternalResource {
  return { id: `${type}_1`, type, data };
}

describe('<CollisionGizmo> primitive shapes', () => {
  it('draws a CapsuleShape3D at its authored radius and full height', async () => {
    const geometry = await geometryOf(shape('CapsuleShape3D', { radius: '0.4', height: '1.8' }));
    expect(geometry.type).toBe('CapsuleGeometry');
    expect(geometry.parameters.radius).toBeCloseTo(0.4, 6);
    // three's `height` param is the CYLINDRICAL middle section; Godot's height
    // is the whole capsule, so middle = height - 2 x radius.
    expect(geometry.parameters.height).toBeCloseTo(1.0, 6);
  });

  it('uses Godot capsule defaults when the resource omits them', async () => {
    const geometry = await geometryOf(shape('CapsuleShape3D'));
    expect(geometry.parameters.radius).toBeCloseTo(0.5, 6);
    expect(geometry.parameters.height).toBeCloseTo(1.0, 6);
  });

  it('degenerates a too-short capsule to a sphere rather than inverting it', async () => {
    const geometry = await geometryOf(shape('CapsuleShape3D', { radius: '1', height: '0.5' }));
    expect(geometry.parameters.height).toBeCloseTo(0, 6);
  });

  it('draws a SphereShape3D at its radius', async () => {
    const geometry = await geometryOf(shape('SphereShape3D', { radius: '1.25' }));
    expect(geometry.type).toBe('SphereGeometry');
    expect(geometry.parameters.radius).toBeCloseTo(1.25, 6);
  });

  it('draws a CylinderShape3D with equal caps and its full height', async () => {
    const geometry = await geometryOf(shape('CylinderShape3D', { radius: '0.75', height: '3' }));
    expect(geometry.type).toBe('CylinderGeometry');
    expect(geometry.parameters.radiusTop).toBeCloseTo(0.75, 6);
    expect(geometry.parameters.radiusBottom).toBeCloseTo(0.75, 6);
    expect(geometry.parameters.height).toBeCloseTo(3, 6);
  });

  it('still falls back to a unit box for a genuinely unknown shape type', async () => {
    const geometry = await geometryOf(shape('SeparationRayShape3D'));
    expect(geometry.type).toBe('BoxGeometry');
  });
});
