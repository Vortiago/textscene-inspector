/**
 * Godot keeps a surface in its alpha pass out of the shadow pass unless it draws depth
 * there, so a glow sprite or a glass pane drops no solid silhouette. The decision is per
 * surface (`render_forward_clustered.cpp:4078-4088` sets `FLAG_PASS_SHADOW` per surface),
 * and a `.tres` material and a `[sub_resource]` arrive the same way.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { parseTresFile } from '../../../parser/parsedResource';
import { standardMaterialTres } from '../../../resources/materials/standardmaterial3d/testing/standardMaterial';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { castsFrom, drawsColour } from '../../../r3f/testing/threePasses';

const ADDITIVE = { transparency: '1', blend_mode: '1', shading_mode: '0' };
const ADDITIVE_TRES = 'res://glow.tres';
const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1_ext', path: ADDITIVE_TRES, type: 'StandardMaterial3D' },
];

const INTERNALS: readonly TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
  { id: 'Additive', type: 'StandardMaterial3D', data: ADDITIVE },
  { id: 'Opaque', type: 'StandardMaterial3D', data: {} },
  { id: 'Glass', type: 'StandardMaterial3D', data: { transparency: '1' } },
  { id: 'PrePass', type: 'StandardMaterial3D', data: { transparency: '4' } },
  inlineTwoSurfaceMesh('Mixed', ['Opaque', 'Additive']),
  inlineTwoSurfaceMesh('Plain', ['Opaque', 'Opaque']),
];

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
  fake.resources.seed(ADDITIVE_TRES, parseTresFile(standardMaterialTres(ADDITIVE)));
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

describe('<MeshInstance3D> shadow-pass exclusion on a primitive mesh', () => {
  it('casts nothing from a [sub_resource] additive material, even with cast_shadow ON', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'SubResource("Additive")' }));
    expect(castsFrom(mesh)).toBe(false);
  });

  it('casts nothing from an ExtResource .tres additive material', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'ExtResource("1_ext")' }));
    expect(castsFrom(mesh)).toBe(false);
  });

  it('casts nothing from a .tres additive surface_material_override/0', async () => {
    const mesh = await renderMesh(
      makeNode({ surfaceMaterialOverrides: new Map([[0, 'ExtResource("1_ext")']]) })
    );
    expect(castsFrom(mesh)).toBe(false);
  });

  it('casts nothing from an alpha-blended MIX material', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'SubResource("Glass")' }));
    expect(castsFrom(mesh)).toBe(false);
  });

  it('casts from ALPHA_DEPTH_PRE_PASS, which draws depth in the alpha pass', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'SubResource("PrePass")' }));
    expect(castsFrom(mesh)).toBe(true);
  });

  it('casts from an opaque material', async () => {
    const mesh = await renderMesh(makeNode({ materialOverride: 'SubResource("Opaque")' }));
    expect(castsFrom(mesh)).toBe(true);
  });
});

describe('<MeshInstance3D> shadow-pass exclusion per ArrayMesh surface', () => {
  it('casts from the opaque surface of a mixed mesh', async () => {
    const mesh = await renderMesh(makeNode({ mesh: 'SubResource("Mixed")' }));
    expect(castsFrom(mesh)).toBe(true);
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
    expect(castsFrom(mesh)).toBe(true);
    expect(castsFrom(mesh, 1)).toBe(false);
  });
});

describe('<MeshInstance3D> shadow-pass exclusion under SHADOWS_ONLY', () => {
  it('casts nothing from an additive surface', async () => {
    // SHADOWS_ONLY hides the colour draw. It never adds a surface to the shadow pass.
    const mesh = await renderMesh(makeNode({ castShadow: 3, materialOverride: 'ExtResource("1_ext")' }));
    expect(castsFrom(mesh)).toBe(false);
  });

  it('draws the additive surface in no colour pass either', async () => {
    const mesh = await renderMesh(makeNode({ castShadow: 3, materialOverride: 'ExtResource("1_ext")' }));
    expect(drawsColour(mesh)).toBe(false);
  });
});
