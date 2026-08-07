/**
 * A multi-surface MeshInstance3D whose slot N (N > 0) resolves to no material.
 *
 * Godot walks every surface of the mesh and falls back per surface — an
 * unpopulated slot gets the SAME hardcoded default shader surface 0 would get,
 * not a lighter or darker stand-in.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

const INTERNALS: TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
  { id: 'Mat_0', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Mat_2', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
];

/** Slots 0 and 2 populated, slot 1 deliberately absent. */
function makeNode(): TscnNode {
  const properties: MeshInstance3DProperties = {
    name: 'M',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map([
      [0, 'SubResource("Mat_0")'],
      [2, 'SubResource("Mat_2")'],
    ]),
    materialOverride: undefined,
  };
  return { name: 'M', type: 'MeshInstance3D', children: [], properties };
}

describe('<MeshInstance3D> unpopulated secondary surface slot', () => {
  it('paints slot 1 with Godot’s default material, not a lighter placeholder', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={INTERNALS}>
        <MeshInstance3D node={makeNode()} />
      </SceneResourcesProvider>
    );
    const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
    expect(materials).toHaveLength(3);

    const gap = materials[1]!;
    const rgb = gap.color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(rgb.r).toBeCloseTo(0.6, 5);
    expect(rgb.g).toBeCloseTo(0.6, 5);
    expect(rgb.b).toBeCloseTo(0.6, 5);
    expect(gap.roughness).toBe(0.8);
    expect(gap.metalness).toBe(0.2);
  });

  it('leaves the populated slots on their own material', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={INTERNALS}>
        <MeshInstance3D node={makeNode()} />
      </SceneResourcesProvider>
    );
    const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
    expect(materials[0]!.color.r).toBeGreaterThan(materials[0]!.color.b);
    expect(materials[2]!.color.b).toBeGreaterThan(materials[2]!.color.r);
  });
});
