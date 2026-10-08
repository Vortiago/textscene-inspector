/**
 * StandardMaterial3D refraction reaches the rendered material. three.js has
 * transmission only on `MeshPhysicalMaterial`, so a refracting material upgrades
 * the slot to one carrying `transmission` and `thickness`. Every other material
 * stays a `MeshStandardMaterial`. `refraction_texture` is out of scope here.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader } from '../../../index';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { drawnMaterials } from '../testing/reactThreeTestInstance';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';

function makeNode(materialId: string, name = 'Mesh'): TscnNode {
  return {
    rawProperties: {},
    name,
    type: 'MeshInstance3D',
    children: [],
    properties: {
      ...GEOMETRY_INSTANCE_DEFAULTS,
      name,
      mesh: 'SubResource("box")',
      materialOverride: `SubResource("${materialId}")`,
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

async function renderWith(node: TscnNode, internalResources: TscnInternalResource[], loader: ResourceLoader) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={internalResources} externalResources={[]}>
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<MeshInstance3D> refraction material (WI-69)', () => {
  it('renders a refraction material as MeshPhysicalMaterial carrying transmission + thickness', async () => {
    const loader = loaderServing();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { refraction_enabled: 'true', refraction_scale: '0.2' } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internal, loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    const physical = drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = physical[0]!;
    expect(material.transmission).toBeCloseTo(1, 5);
    expect(material.thickness).toBeCloseTo(0.2, 5);
    // Godot exposes no ior, so it stays at three's glass default of 1.5.
    expect(material.ior).toBe(1.5);
  });

  it('keeps a material with no refraction on the standard (non-physical) material', async () => {
    // Only an enabled refraction upgrades to physical. The common path stays the
    // MeshStandardMaterial every other test asserts on.
    const loader = loaderServing();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { roughness: '0.4' } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internal, loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial')).toHaveLength(
      0
    );
    expect(drawnMaterials<THREE.MeshStandardMaterial>(renderer.scene, 'MeshStandardMaterial')).toHaveLength(
      1
    );
  });
});
