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
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { materialInstanceAs } from '../testing/reactThreeTestInstance';

/** Provider that never loads anything: textures are pre-cached directly. */
class NoopProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
  }
}

function makeLoader(): ResourceLoader {
  const provider = new NoopProvider();
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return loader;
}

/**
 * Inject a texture into the loader's cache as if the file pipeline had loaded
 * it, so `useResource` resolves it synchronously.
 */
function preloadTexture(loader: ResourceLoader, path: string, texture: THREE.Texture): void {
  const store = new Map<string, THREE.Texture>();
  const existing = (loader.textures as unknown as { __fakes?: Map<string, THREE.Texture> }).__fakes;
  const fakes = existing ?? store;
  fakes.set(path, texture);
  if (!existing) {
    (loader.textures as unknown as { __fakes: Map<string, THREE.Texture> }).__fakes = fakes;
    const originalGetCached = loader.textures.getCached.bind(loader.textures);
    const originalRequest = loader.textures.request.bind(loader.textures);
    loader.textures.getCached = (p: string) => fakes.get(p) ?? originalGetCached(p);
    loader.textures.request = (p: string) => {
      const f = fakes.get(p);
      if (f) {
        loader.eventBus.emit<THREE.Texture>('texture', 'loaded', p, f);
        return;
      }
      originalRequest(p);
    };
  }
}

function makeNode(materialId: string, name = 'Mesh'): TscnNode {
  return {
    name,
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name,
      mesh: 'SubResource("box")',
      materialOverride: `SubResource("${materialId}")`,
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

function tree(node: TscnNode, internal: TscnInternalResource[], external: TscnExternalResource[], loader: ResourceLoader) {
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
    const loader = makeLoader();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      { id: 'mat', type: 'StandardMaterial3D', data: { id: 'mat', anisotropy_enabled: 'true', anisotropy: '0.8' } as Record<string, string> },
    ];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, [], loader));
    await new Promise<void>((r) => setTimeout(r, 10));

    const physical = renderer.scene.findAllByType('MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = materialInstanceAs<THREE.MeshPhysicalMaterial>(physical[0]!);
    expect(material.anisotropy).toBeCloseTo(0.8, 5);
    expect(material.anisotropyRotation).toBeCloseTo(0, 5);
  });

  it('renders a negative anisotropy with a 90° perpendicular rotation', async () => {
    const loader = makeLoader();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      { id: 'mat', type: 'StandardMaterial3D', data: { id: 'mat', anisotropy_enabled: 'true', anisotropy: '-0.8' } as Record<string, string> },
    ];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, [], loader));
    await new Promise<void>((r) => setTimeout(r, 10));

    const physical = renderer.scene.findAllByType('MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = materialInstanceAs<THREE.MeshPhysicalMaterial>(physical[0]!);
    expect(material.anisotropy).toBeCloseTo(0.8, 5); // magnitude preserved
    expect(material.anisotropyRotation).toBeCloseTo(Math.PI / 2, 5); // direction flipped perpendicular
  });

  it('keeps a material with no anisotropy on the standard (non-physical) material', async () => {
    // The common path stays MeshStandardMaterial, the type every other test
    // asserts on. Only an enabled anisotropy upgrades to physical.
    const loader = makeLoader();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      { id: 'mat', type: 'StandardMaterial3D', data: { id: 'mat', roughness: '0.4' } as Record<string, string> },
    ];

    const renderer = await ReactThreeTestRenderer.create(tree(makeNode('mat'), internal, [], loader));
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(renderer.scene.findAllByType('MeshPhysicalMaterial')).toHaveLength(0);
    expect(renderer.scene.findAllByType('MeshStandardMaterial')).toHaveLength(1);
  });

  /**
   * Render one anisotropic material whose `anisotropy_flowmap` resolves to
   * `texture`, and hand back the physical material it produced.
   */
  async function renderWithFlowmap(texture: THREE.Texture): Promise<THREE.MeshPhysicalMaterial> {
    const loader = makeLoader();
    const path = 'res://textures/aniso_flow.png';
    preloadTexture(loader, path, texture);

    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
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

    const physical = renderer.scene.findAllByType('MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    return materialInstanceAs<THREE.MeshPhysicalMaterial>(physical[0]!);
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
    const loader = makeLoader();
    const path = 'res://textures/aniso_flow.png';
    const flow = new THREE.DataTexture(new Uint8Array([128, 128, 0, 200]), 1, 1, THREE.RGBAFormat);
    flow.needsUpdate = true;
    preloadTexture(loader, path, flow);

    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
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

    const material = materialInstanceAs<THREE.MeshPhysicalMaterial>(
      renderer.scene.findAllByType('MeshPhysicalMaterial')[0]!
    );
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
