/**
 * StandardMaterial3D features on <MeshInstance3D>: every loaded texture map, the
 * `uv1_scale` and `uv1_offset` on a clone per consumer, and `emission_enabled = false`
 * forcing a black emissive. Textures are pre-cached, and
 * `Component.missing-texture.test.tsx` covers the async load path.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import {
  ResourceLoaderProvider,
  ResourceLoader,
  FileEventBus,
} from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { materialInstanceAs } from '../testing/reactThreeTestInstance';

/** Provider that always returns null: these tests pre-cache textures. */
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
 * Inject a texture as if the file pipeline had loaded it, by patching `request()`
 * and `getCached()`, since no public surface pre-caches one. `loaded` fires
 * synchronously on `request()`, so `useResource` sees a cache hit.
 */
function preloadTexture(loader: ResourceLoader, path: string, texture: THREE.Texture): void {
  const fakes = new Map<string, THREE.Texture>();
  const existing = (loader.textures as unknown as { __fakes?: Map<string, THREE.Texture> }).__fakes;
  const store = existing ?? fakes;
  store.set(path, texture);
  if (!existing) {
    (loader.textures as unknown as { __fakes: Map<string, THREE.Texture> }).__fakes = store;
    const originalGetCached = loader.textures.getCached.bind(loader.textures);
    const originalRequest = loader.textures.request.bind(loader.textures);
    loader.textures.getCached = (p: string) => {
      const f = store.get(p);
      if (f) return f;
      return originalGetCached(p);
    };
    loader.textures.request = (p: string) => {
      const f = store.get(p);
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

function findMaterial(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>
): THREE.MeshStandardMaterial | undefined {
  const materials = renderer.scene.findAllByType('MeshStandardMaterial');
  const first = materials[0];
  return first ? materialInstanceAs<THREE.MeshStandardMaterial>(first) : undefined;
}

async function renderWith(
  node: TscnNode,
  internalResources: TscnInternalResource[],
  externalResources: TscnExternalResource[],
  loader: ResourceLoader
) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={externalResources}
      >
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<MeshInstance3D> material features (WI-R3F-8)', () => {
  it('applies uv1_scale to the loaded albedo texture via texture.repeat', async () => {
    const loader = makeLoader();
    const tex = new THREE.Texture();
    preloadTexture(loader, 'res://textures/checker.png', tex);

    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          albedo_texture: 'ExtResource("1")',
          uv1_scale: 'Vector3(2, 2, 1)',
        } as Record<string, string>,
      },
    ];
    const externalResources: TscnExternalResource[] = [
      { id: '1', path: 'res://textures/checker.png', type: 'Texture2D' },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, externalResources, loader);
    // Wait one tick for the synchronous loaded-event subscription to
    // hydrate the hook's state and re-render.
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={internalResources}
          externalResources={externalResources}
        >
          <MeshInstance3D node={makeNode('mat')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const material = findMaterial(renderer);
    expect(material).toBeDefined();
    expect(material!.map).toBeDefined();
    expect(material!.map!.repeat.x).toBe(2);
    expect(material!.map!.repeat.y).toBe(2);
    // The clone is not the cached THREE.Texture, which other consumers share.
    expect(material!.map).not.toBe(tex);
  });

  it('wires the loaded normal texture onto material.normalMap', async () => {
    const loader = makeLoader();
    const albedo = new THREE.Texture();
    const normal = new THREE.Texture();
    // As the loader hands them out: every decoded image is tagged sRGB before
    // any slot is known, which is exactly what the normal slot must undo.
    albedo.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.SRGBColorSpace;
    preloadTexture(loader, 'res://textures/albedo.png', albedo);
    preloadTexture(loader, 'res://textures/normal.png', normal);

    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          albedo_texture: 'ExtResource("1")',
          // Godot emits the normal sampler only inside `if (features[…])`.
          normal_enabled: 'true',
          normal_texture: 'ExtResource("2")',
        } as Record<string, string>,
      },
    ];
    const externalResources: TscnExternalResource[] = [
      { id: '1', path: 'res://textures/albedo.png', type: 'Texture2D' },
      { id: '2', path: 'res://textures/normal.png', type: 'Texture2D' },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, externalResources, loader);
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={internalResources}
          externalResources={externalResources}
        >
          <MeshInstance3D node={makeNode('mat')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const material = findMaterial(renderer);
    expect(material).toBeDefined();
    expect(material!.normalMap).toBeDefined();
    // Not identity, unlike the colour maps: `scene/resources/material.cpp:1092`
    // declares `texture_normal : hint_roughness_normal` with no `source_color`, so
    // the material gets an undecoded clone. The shared `Source` identifies it.
    expect(material!.normalMap).not.toBe(normal);
    expect(material!.normalMap!.source).toBe(normal.source);
    expect(material!.normalMap!.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('forces emissive to 0x000000 when emission_enabled is false', async () => {
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          // emission_enabled not set (defaults to false). Even with a
          // color set, the rendered material's emissive must be black.
          emission: 'Color(1, 0, 0, 1)',
          emission_energy_multiplier: '5',
        } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    const material = findMaterial(renderer);
    expect(material).toBeDefined();
    expect(material!.emissive.getHex()).toBe(0x000000);
  });

  it('respects emission color + energy when emission_enabled is true', async () => {
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          emission_enabled: 'true',
          emission: 'Color(1, 0, 0, 1)',
          emission_energy_multiplier: '5',
        } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    const material = findMaterial(renderer);
    expect(material).toBeDefined();
    expect(material!.emissive.getHex()).toBe(0xff0000);
    expect(material!.emissiveIntensity).toBe(5);
  });

  it('clones the shared texture per consumer so different uv_scale values do not clobber each other', async () => {
    const loader = makeLoader();
    const tex = new THREE.Texture();
    preloadTexture(loader, 'res://textures/shared.png', tex);

    const externalResources: TscnExternalResource[] = [
      { id: '1', path: 'res://textures/shared.png', type: 'Texture2D' },
    ];
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'matA',
        type: 'StandardMaterial3D',
        data: {
          id: 'matA',
          albedo_texture: 'ExtResource("1")',
          uv1_scale: 'Vector3(0.5, 0.5, 1)',
        } as Record<string, string>,
      },
      {
        id: 'matB',
        type: 'StandardMaterial3D',
        data: {
          id: 'matB',
          albedo_texture: 'ExtResource("1")',
          uv1_scale: 'Vector3(2, 2, 1)',
        } as Record<string, string>,
      },
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={internalResources}
          externalResources={externalResources}
        >
          <MeshInstance3D node={makeNode('matA', 'MeshA')} />
          <MeshInstance3D node={makeNode('matB', 'MeshB')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={internalResources}
          externalResources={externalResources}
        >
          <MeshInstance3D node={makeNode('matA', 'MeshA')} />
          <MeshInstance3D node={makeNode('matB', 'MeshB')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const materials = renderer.scene.findAllByType('MeshStandardMaterial');
    expect(materials).toHaveLength(2);
    const [matA, matB] = materials.map((m) => materialInstanceAs<THREE.MeshStandardMaterial>(m));

    expect(matA!.map).toBeDefined();
    expect(matB!.map).toBeDefined();
    // Each consumer got its own cloned Texture instance.
    expect(matA!.map).not.toBe(matB!.map);
    // Neither clone is the cached original.
    expect(matA!.map).not.toBe(tex);
    expect(matB!.map).not.toBe(tex);
    // And the repeat values are independently set.
    expect(matA!.map!.repeat.x).toBe(0.5);
    expect(matB!.map!.repeat.x).toBe(2);
  });

  it('renders a clearcoat material as MeshPhysicalMaterial carrying the coat scalars', async () => {
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          clearcoat_enabled: 'true',
          clearcoat: '0.7',
          clearcoat_roughness: '0.25',
        } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    // A coat upgrades the slot to three.js's MeshPhysicalMaterial (the only
    // material with native clearcoat), carrying the parsed strength + roughness.
    const physical = renderer.scene.findAllByType('MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = materialInstanceAs<THREE.MeshPhysicalMaterial>(physical[0]!);
    expect(material.clearcoat).toBeCloseTo(0.7, 5);
    expect(material.clearcoatRoughness).toBeCloseTo(0.25, 5);
  });

  it('keeps a material with no clearcoat on the standard (non-physical) material', async () => {
    // The common path stays MeshStandardMaterial, the type every other test
    // asserts on. Only an enabled coat upgrades to MeshPhysicalMaterial.
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { id: 'mat', roughness: '0.4' } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(renderer.scene.findAllByType('MeshPhysicalMaterial')).toHaveLength(0);
    expect(renderer.scene.findAllByType('MeshStandardMaterial')).toHaveLength(1);
  });

  it('renders a rim material as MeshPhysicalMaterial with rim mapped to sheen', async () => {
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          rim_enabled: 'true',
          rim: '0.7',
          rim_tint: '0.25',
        } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    // Rim upgrades the slot to MeshPhysicalMaterial and maps the rim strength
    // onto three.js's Fresnel sheen term (the closest native analog).
    const physical = renderer.scene.findAllByType('MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = materialInstanceAs<THREE.MeshPhysicalMaterial>(physical[0]!);
    expect(material.sheen).toBeCloseTo(0.7, 5);
  });

  it('applies heightmap_scale to the rendered material.displacementScale', async () => {
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: {
          id: 'mat',
          heightmap_enabled: 'true',
          heightmap_scale: '3',
        } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    const material = findMaterial(renderer);
    expect(material).toBeDefined();
    expect(material!.displacementScale).toBe(3);
  });

  it('leaves displacementScale at 0 (no displacement) for a non-heightmap material', async () => {
    const loader = makeLoader();
    const internalResources: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { id: 'mat', roughness: '0.4' } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internalResources, [], loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    const material = findMaterial(renderer);
    expect(material!.displacementScale).toBe(0);
  });
});
