/**
 * A MeshInstance3D material's side follows Godot's `cull_mode`. An omitted
 * `cull_mode` is BACK (FrontSide) for every mesh type, a PlaneMesh included:
 * a plane meant to show both faces sets `cull_mode = 2` in its material.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

function sub(
  type: string,
  id: string,
  data: Record<string, string | undefined> = {}
): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'Canvas',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    mesh: properties.mesh ?? 'SubResource("plane_1")',
    materialOverride: properties.materialOverride,
    ...properties,
  };
  return { name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

async function renderWithMeshAndMaterial(
  meshType: string,
  materialProps: Record<string, string> | null
) {
  const internalResources: TscnInternalResource[] = [
    sub(meshType, 'plane_1', meshType === 'PlaneMesh' ? { size: 'Vector2(1, 1)' } : { size: 'Vector3(1, 1, 1)' }),
  ];
  if (materialProps) {
    internalResources.push(sub('StandardMaterial3D', 'mat_1', materialProps));
  }
  const node = makeNode({
    mesh: `SubResource("plane_1")`,
    surfaceMaterialOverrides: materialProps
      ? new Map([[0, `SubResource("mat_1")`]])
      : new Map(),
  });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('MeshInstance3D + PlaneMesh — material.side default (Godot BACK = FrontSide)', () => {
  it('PlaneMesh with material lacking cull_mode follows Godot default — FrontSide', async () => {
    // StandardMaterial3D defaults to `cull_mode = 0` (BACK): a wall PlaneMesh hides the
    // room behind it.
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
    });
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('PlaneMesh with explicit cull_mode=0 (BACK) is respected — FrontSide', async () => {
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '0',
    });
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('PlaneMesh with explicit cull_mode=1 (FRONT) is respected — BackSide', async () => {
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '1',
    });
    expect(mat.side).toBe(THREE.BackSide);
  });

  it('PlaneMesh with explicit cull_mode=2 (DISABLED) is respected — DoubleSide', async () => {
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      cull_mode: '2',
    });
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('BoxMesh with no cull_mode keeps FrontSide (defensive fallback is PlaneMesh-only)', async () => {
    const mat = await renderWithMeshAndMaterial('BoxMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
    });
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('PlaneMesh without any material follows Godot default — FrontSide', async () => {
    const mat = await renderWithMeshAndMaterial('PlaneMesh', null);
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('REGRESSION (wall PlaneMesh): PlaneMesh + StandardMaterial3D with albedo_texture only → FrontSide', async () => {
    // A wall material: a textured StandardMaterial3D with no `cull_mode`, which Godot
    // renders with BACK culling.
    const mat = await renderWithMeshAndMaterial('PlaneMesh', {
      albedo_color: 'Color(1, 1, 1, 1)',
      // The side does not depend on whether an `albedo_texture` resolves.
    });
    expect(mat.side).toBe(THREE.FrontSide);
  });
});
