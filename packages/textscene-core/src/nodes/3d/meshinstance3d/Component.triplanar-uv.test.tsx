/**
 * World-triplanar planar tiling. Hallway floor/ceiling planes
 * use `uv1_world_triplanar = true`, where Godot tiles the texture once per
 * world unit × uv1_scale. We don't run a triplanar shader, but for a PlaneMesh
 * the tiling density is reproduced exactly by setting `repeat = size × scale`.
 * Before this, the floor texture stretched a single copy across the whole
 * 12×3.5 plane and read as "too big".
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

const FLOOR_TEX = 'res://floor.png';

function makeNode(): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'Floor',
    surfaceMaterialOverrides: new Map(),
    mesh: 'SubResource("Plane")',
    materialOverride: 'SubResource("Mat")',
  };
  return { name: 'Floor', type: 'MeshInstance3D', children: [], properties: props };
}

async function renderFloor(
  matData: Record<string, string>,
  planeSize: string
): Promise<THREE.MeshStandardMaterial> {
  const fake = createFakeResourceLoader();
  fake.textures.seed(FLOOR_TEX, new THREE.Texture());
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[
          { id: 'Plane', type: 'PlaneMesh', data: { size: planeSize } },
          { id: 'Mat', type: 'StandardMaterial3D', data: matData },
        ]}
        externalResources={[{ id: '1', type: 'Texture2D', path: FLOOR_TEX }]}
      >
        <MeshInstance3D node={makeNode()} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('MeshInstance3D — triplanar planar tiling (WI-HALL-5)', () => {
  it('world-triplanar floor tiles per world unit: repeat = plane size × uv1_scale', async () => {
    const mat = await renderFloor(
      { albedo_texture: 'ExtResource("1")', uv1_triplanar: 'true', uv1_world_triplanar: 'true' },
      'Vector2(12, 3.5)'
    );
    expect(mat.map?.repeat.x).toBeCloseTo(12, 5);
    expect(mat.map?.repeat.y).toBeCloseTo(3.5, 5);
    expect(mat.map?.wrapS).toBe(THREE.RepeatWrapping);
    expect(mat.map?.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('folds uv1_scale into the triplanar tiling (ceiling 0.5 → 6 × 1.75)', async () => {
    const mat = await renderFloor(
      {
        albedo_texture: 'ExtResource("1")',
        uv1_scale: 'Vector3(0.5, 0.5, 0.5)',
        uv1_world_triplanar: 'true',
      },
      'Vector2(12, 3.5)'
    );
    expect(mat.map?.repeat.x).toBeCloseTo(6, 5);
    expect(mat.map?.repeat.y).toBeCloseTo(1.75, 5);
  });

  it('NON-triplanar plane keeps uv1_scale as the literal repeat (no size multiply)', async () => {
    // Regression guard: the size-multiply must only fire for triplanar
    // materials, or every existing uv1_scale assertion (40–47) would break.
    const mat = await renderFloor(
      { albedo_texture: 'ExtResource("1")', uv1_scale: 'Vector3(2, 2, 1)' },
      'Vector2(12, 3.5)'
    );
    expect(mat.map?.repeat.x).toBeCloseTo(2, 5);
    expect(mat.map?.repeat.y).toBeCloseTo(2, 5);
  });
});
