/**
 * `GeometryInstance3D.transparency` reaches every surface the instance draws: its own
 * surfaces and the `material_overlay` pass. A transparency above zero moves each of them to
 * the alpha pass (`render_forward_clustered.cpp:1128`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { DROPS_ALBEDO_ALPHA, patchedFragment } from '../../../r3f/testing/patchedFragment';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import { HALF_FADE_ALPHA } from '../../../r3f/testing/halfFadeAlpha';
import { manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';

const INTERNALS: TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
  inlineTwoSurfaceMesh('Array_1'),
  { id: 'Mat_overlay', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
  { id: 'Mat_opaque', type: 'StandardMaterial3D', data: {} },
  { id: 'Mat_scissor', type: 'StandardMaterial3D', data: { transparency: '2' } },
];

function makeNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const full: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'M',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    ...properties,
  };
  return { rawProperties: {}, name: 'M', type: 'MeshInstance3D', children: [], properties: full };
}

async function drawnMaterials(properties: Partial<MeshInstance3DProperties>): Promise<THREE.Material[]> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={INTERNALS}>
      <MeshInstance3D node={makeNode(properties)} />
    </SceneResourcesProvider>
  );
  await renderScene(renderer, manualCameraAt({ x: 0, y: 0, z: 5 }));
  return renderer.scene.findAllByType('Mesh').flatMap((m) => (m.instance as THREE.Mesh).material);
}

describe('MeshInstance3D — transparency', () => {
  it('keeps an opaque instance in the opaque pass', async () => {
    const [material] = await drawnMaterials({});
    expect(material).toMatchObject({ transparent: false, depthWrite: true, opacity: 1 });
  });

  it('blends a primitive mesh surface at the fade alpha', async () => {
    const [material] = await drawnMaterials({ transparency: 0.5 });
    expect(material).toMatchObject({ transparent: true, depthWrite: false, opacity: HALF_FADE_ALPHA });
  });

  it('drops the texture and vertex alpha of an opaque material', async () => {
    const [material] = await drawnMaterials({
      materialOverride: 'SubResource("Mat_opaque")',
      transparency: 0.5,
    });
    expect(patchedFragment(material!)).toContain(DROPS_ALBEDO_ALPHA);
  });

  it('overwrites past the scissor cut of a MIX material, as Godot writes alpha 1 there', async () => {
    const [material] = await drawnMaterials({
      materialOverride: 'SubResource("Mat_scissor")',
      transparency: 0.5,
    });
    expect(material).toMatchObject({ transparent: true, depthWrite: false, blending: THREE.NoBlending });
  });

  it('blends every surface of an ArrayMesh', async () => {
    const materials = await drawnMaterials({ mesh: 'SubResource("Array_1")', transparency: 0.5 });
    expect(materials).toHaveLength(2);
    for (const material of materials) {
      expect(material).toMatchObject({ transparent: true, opacity: HALF_FADE_ALPHA });
    }
  });

  it('blends the material_overlay pass too', async () => {
    const [, overlay] = await drawnMaterials({
      materialOverlay: 'SubResource("Mat_overlay")',
      transparency: 0.5,
    });
    expect(overlay).toMatchObject({ transparent: true, opacity: HALF_FADE_ALPHA });
  });
});
