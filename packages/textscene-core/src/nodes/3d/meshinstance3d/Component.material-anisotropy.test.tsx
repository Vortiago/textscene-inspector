/**
 * StandardMaterial3D anisotropy upgrades the slot to `<meshPhysicalMaterial>`, the
 * only three.js material with it: `anisotropy` is the strength, `anisotropyRotation`
 * π/2 for a negative value, and `anisotropyMap` the repacked `anisotropy_flowmap`.
 * Every other material stays `MeshStandardMaterial`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader } from '../../../index';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { drawnMaterials } from '../testing/reactThreeTestInstance';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { preloadResource } from '../../../resources/testing/preloadResource';
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

function tree(
  node: TscnNode,
  internal: TscnInternalResource[],
  external: TscnExternalResource[],
  loader: ResourceLoader
) {
  return (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={internal} externalResources={external}>
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<MeshInstance3D> anisotropy material (WI-68)', () => {
  it('renders a positive anisotropy as MeshPhysicalMaterial with strength and no rotation', async () => {
    const loader = loaderServing();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { anisotropy_enabled: 'true', anisotropy: '0.8' } as Record<string, string>,
      },
    ];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, [], loader));
    await new Promise<void>((r) => setTimeout(r, 10));

    const physical = drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = physical[0]!;
    expect(material.anisotropy).toBeCloseTo(0.8, 5);
    expect(material.anisotropyRotation).toBeCloseTo(0, 5);
  });

  it('renders a negative anisotropy with a 90° perpendicular rotation', async () => {
    const loader = loaderServing();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { anisotropy_enabled: 'true', anisotropy: '-0.8' } as Record<string, string>,
      },
    ];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, [], loader));
    await new Promise<void>((r) => setTimeout(r, 10));

    const physical = drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = physical[0]!;
    expect(material.anisotropy).toBeCloseTo(0.8, 5); // magnitude preserved
    expect(material.anisotropyRotation).toBeCloseTo(Math.PI / 2, 5); // direction flipped perpendicular
  });

  it('keeps a material with no anisotropy on the standard (non-physical) material', async () => {
    // The common path stays MeshStandardMaterial, the type every other test
    // asserts on. Only an enabled anisotropy upgrades to physical.
    const loader = loaderServing();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { roughness: '0.4' } as Record<string, string>,
      },
    ];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, [], loader));
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial')).toHaveLength(
      0
    );
    expect(drawnMaterials<THREE.MeshStandardMaterial>(renderer.scene, 'MeshStandardMaterial')).toHaveLength(
      1
    );
  });

  /**
   * Render one anisotropic material whose `anisotropy_flowmap` resolves to
   * `texture`, and hand back the physical material it produced.
   */
  async function renderWithFlowmap(texture: THREE.Texture): Promise<THREE.MeshPhysicalMaterial> {
    const loader = loaderServing();
    const path = 'res://textures/aniso_flow.png';
    preloadResource(loader, 'texture', path, texture);

    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          anisotropy_enabled: 'true',
          anisotropy: '0.8',
          anisotropy_flowmap: 'ExtResource("2")',
        } as Record<string, string>,
      },
    ];
    const external: TscnExternalResource[] = [{ id: '2', path, type: 'Texture2D' }];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, external, loader));
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(tree(makeNode('mat'), internal, external, loader));

    const physical = drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    return physical[0]!;
  }

  it('wires anisotropy_flowmap onto material.anisotropyMap, repacking Godot alpha-strength into three.js blue', async () => {
    // Godot's flowmap holds direction in R/G (128,128 = neutral) and strength in
    // alpha (200). three@0.185 `anisotropyMap` reads strength from blue, so the
    // map copies alpha into blue, asserted on the raw pixels of a `DataTexture`.
    const flow = new THREE.DataTexture(new Uint8Array([128, 128, 0, 200]), 1, 1, THREE.RGBAFormat);
    flow.needsUpdate = true;

    const material = await renderWithFlowmap(flow);

    expect(material.anisotropyMap).toBeTruthy();
    const data = (material.anisotropyMap!.image as { data: Uint8Array }).data;
    // Strength repacked from Godot alpha (200) into three.js blue.
    expect(data[2]).toBe(200);
    // Direction channels pass through unchanged.
    expect(data[0]).toBe(128);
    expect(data[1]).toBe(128);
    // The cached source texture is not mutated, since other consumers of that
    // flowmap share it: its blue stays 0.
    expect((flow.image as { data: Uint8Array }).data[2]).toBe(0);
  });

  it('keeps scalar anisotropy when the flowmap pixels cannot be read', async () => {
    // An image-backed texture (a real PNG) needs a canvas readback, which this
    // environment lacks. The material then carries no map rather than a wrong-channel
    // one, and keeps the strength. The `material-anisotropy-flowmap` golden covers the readback.
    const undecodable = new THREE.Texture({ width: 4, height: 4 } as HTMLImageElement);

    const material = await renderWithFlowmap(undecodable);

    expect(material.anisotropyMap).toBeNull();
    expect(material.anisotropy).toBeCloseTo(0.8, 5);
  });

  it('disposes the UV-transformed flowmap the material actually samples', async () => {
    // A non-identity `uv1_scale` hands the material a clone of the repack, and
    // three keys the GPU texture on the sampler parameters the clone changes, so
    // only the clone is uploaded. The texture on the material is the one to
    // release on unmount.
    const loader = loaderServing();
    const path = 'res://textures/aniso_flow.png';
    const flow = new THREE.DataTexture(new Uint8Array([128, 128, 0, 200]), 1, 1, THREE.RGBAFormat);
    flow.needsUpdate = true;
    preloadResource(loader, 'texture', path, flow);

    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: {} },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          anisotropy_enabled: 'true',
          anisotropy: '0.8',
          anisotropy_flowmap: 'ExtResource("2")',
          uv1_scale: 'Vector3(3, 3, 1)',
        } as Record<string, string>,
      },
    ];
    const external: TscnExternalResource[] = [{ id: '2', path, type: 'Texture2D' }];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, external, loader));
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(tree(makeNode('mat'), internal, external, loader));

    const material = drawnMaterials<THREE.MeshPhysicalMaterial>(renderer.scene, 'MeshPhysicalMaterial')[0]!;
    const sampled = material.anisotropyMap!;
    // The clone, not the repack: only the UV transform sets `repeat`.
    expect(sampled.repeat.x).toBeCloseTo(3, 5);

    let disposed = false;
    sampled.addEventListener('dispose', () => {
      disposed = true;
    });

    await renderer.unmount();

    expect(disposed).toBe(true);
  });
});
