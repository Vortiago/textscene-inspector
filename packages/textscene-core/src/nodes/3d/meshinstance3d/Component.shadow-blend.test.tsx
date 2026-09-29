/**
 * Godot keeps an additive, subtractive or multiply surface out of the shadow pass,
 * so a glow sprite drops no solid silhouette. The decision is per surface
 * (`render_forward_clustered.cpp:4078-4088` sets `FLAG_PASS_SHADOW` per surface),
 * and a `.tres` material and a `[sub_resource]` arrive the same way.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { buildStandardMaterial } from '../../../resources/materials/standardmaterial3d/build';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import {
  cameraLookingAt,
  drawColourGroup,
  drawShadowGroup,
  writesAnything,
} from '../../../r3f/testing/threePasses';

const ADDITIVE = { transparency: '1', blend_mode: '1', shading_mode: '0' };
const ADDITIVE_TRES = 'res://glow.tres';
const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1_ext', path: ADDITIVE_TRES, type: 'StandardMaterial3D' },
];

const INTERNALS: readonly TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
  { id: 'Additive', type: 'StandardMaterial3D', data: ADDITIVE },
  { id: 'Opaque', type: 'StandardMaterial3D', data: {} },
  inlineTwoSurfaceMesh('Mixed', ['Opaque', 'Additive']),
  inlineTwoSurfaceMesh('Plain', ['Opaque', 'Opaque']),
];

const camera = cameraLookingAt({ x: 4, y: 3, z: 12 });
const shadowCamera = cameraLookingAt({ x: -8, y: 20, z: 1 });

function makeNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const full: MeshInstance3DProperties = {
    name: 'Glow',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    castShadow: 1,
    ...properties,
  };
  return { name: 'Glow', type: 'MeshInstance3D', children: [], properties: full };
}

async function renderMesh(node: TscnNode): Promise<THREE.Mesh> {
  const fake = createFakeResourceLoader();
  fake.materials.seed(ADDITIVE_TRES, buildStandardMaterial(parseStandardMaterial3DScalars(ADDITIVE)));
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const mesh = findMesh(renderer.scene);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function castsFrom(mesh: THREE.Mesh, groupIndex: number): boolean {
  if (!mesh.castShadow) return false;
  return drawShadowGroup(mesh, camera, shadowCamera, groupIndex, (s) =>
    writesAnything(s.depthMaterial!)
  );
}

describe('<MeshInstance3D> blend-mode shadow exclusion on a primitive mesh', () => {
  it('casts nothing from a [sub_resource] additive material, even with cast_shadow ON', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'SubResource("Additive")' }));
    expect(castsFrom(mesh, 0)).toBe(false);
  });

  it('casts nothing from an ExtResource .tres additive material', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'ExtResource("1_ext")' }));
    expect(castsFrom(mesh, 0)).toBe(false);
  });

  it('casts nothing from a .tres additive surface_material_override/0', async () => {
    const mesh = await renderMesh(
      makeNode({ surfaceMaterialOverrides: new Map([[0, 'ExtResource("1_ext")']]) })
    );
    expect(castsFrom(mesh, 0)).toBe(false);
  });

  it('casts from an opaque material', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'SubResource("Opaque")' }));
    expect(castsFrom(mesh, 0)).toBe(true);
  });
});

describe('<MeshInstance3D> blend-mode shadow exclusion per ArrayMesh surface', () => {
  it('casts from the opaque surface of a mixed mesh', async () => {
    const mesh = await renderMesh(makeNode({ mesh: 'SubResource("Mixed")' }));
    expect(castsFrom(mesh, 0)).toBe(true);
  });

  it('casts nothing from the additive surface of the same mesh', async () => {
    const mesh = await renderMesh(makeNode({ mesh: 'SubResource("Mixed")' }));
    expect(castsFrom(mesh, 1)).toBe(false);
  });

  it('casts nothing from a surface a .tres additive override replaces', async () => {
    const mesh = await renderMesh(
      makeNode({
        mesh: 'SubResource("Plain")',
        surfaceMaterialOverrides: new Map([[1, 'ExtResource("1_ext")']]),
      })
    );
    expect(castsFrom(mesh, 0)).toBe(true);
    expect(castsFrom(mesh, 1)).toBe(false);
  });
});

describe('<MeshInstance3D> blend-mode shadow exclusion under SHADOWS_ONLY', () => {
  it('casts nothing from an additive surface', async () => {
    // SHADOWS_ONLY hides the colour draw. It never adds a surface to the shadow pass.
    const mesh = await renderMesh(
      makeNode({ castShadow: 3, materialOverride: 'ExtResource("1_ext")' })
    );
    expect(castsFrom(mesh, 0)).toBe(false);
  });

  it('draws the additive surface in no colour pass either', async () => {
    const mesh = await renderMesh(
      makeNode({ castShadow: 3, materialOverride: 'ExtResource("1_ext")' })
    );
    expect(drawColourGroup(mesh, camera, 0, (s) => writesAnything(s.material))).toBe(false);
  });
});
