/**
 * Render-side contract for StandardMaterial3D anisotropy.
 *
 * Parsing anisotropy is necessary but not sufficient — the values have to reach
 * the rendered material or nothing changes on screen. three.js exposes
 * anisotropy only on `MeshPhysicalMaterial` (like clearcoat / sheen), so an
 * anisotropy-bearing StandardMaterial3D must upgrade the slot to a
 * `<meshPhysicalMaterial>` carrying:
 *   - `material.anisotropy` (strength magnitude),
 *   - `material.anisotropyRotation` (direction — π/2 for a negative Godot value), and
 *   - `material.anisotropyMap` (from `anisotropy_flowmap`), REPACKED so the
 *     effect strength lands where three.js reads it.
 *
 * The flowmap channel repack: Godot's `anisotropy_flowmap` carries direction in
 * R/G and STRENGTH in the ALPHA channel; three.js's `anisotropyMap` carries
 * direction in R/G and STRENGTH in the BLUE channel (verified in the installed
 * three@0.185 MeshPhysicalMaterial source). A faithful map therefore copies the
 * source ALPHA into the BLUE channel; passing the texture straight through would
 * feed three.js an arbitrary blue channel as "strength" and break the effect.
 * This is pinned with a `DataTexture` of known RGBA so it is asserted on the raw
 * pixel array (no canvas / WebGL needed in the test environment). A real asset
 * instead arrives image-backed and needs a canvas readback, which this
 * environment cannot do — the last test pins that it degrades to scalar-only
 * anisotropy, and the `material-anisotropy-flowmap` golden covers the readback
 * itself in a real browser.
 *
 * Every non-anisotropy material stays on the lighter `MeshStandardMaterial` —
 * the type the rest of the suite asserts on.
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

/** Provider that never loads anything — textures are pre-cached directly. */
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
 * it, so `useResource` resolves it synchronously (mirrors
 * Component.material-features.test.tsx).
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
    const material = physical[0]!.instance as THREE.MeshPhysicalMaterial;
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
    const material = physical[0]!.instance as THREE.MeshPhysicalMaterial;
    expect(material.anisotropy).toBeCloseTo(0.8, 5); // magnitude preserved
    expect(material.anisotropyRotation).toBeCloseTo(Math.PI / 2, 5); // direction flipped perpendicular
  });

  it('keeps a material with no anisotropy on the standard (non-physical) material', async () => {
    // GUARDRAIL: the common path must stay MeshStandardMaterial so existing
    // behaviour — and the material type every other test asserts on — is
    // unchanged; only an enabled anisotropy upgrades to physical.
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
    return physical[0]!.instance as THREE.MeshPhysicalMaterial;
  }

  it('wires anisotropy_flowmap onto material.anisotropyMap, repacking Godot alpha-strength into three.js blue', async () => {
    // Known-pixel flowmap: R/G direction (128,128 = neutral), B unused (0),
    // A = strength (200). three.js reads strength from BLUE, so a faithful map
    // must end up with blue == the source alpha (200).
    const flow = new THREE.DataTexture(new Uint8Array([128, 128, 0, 200]), 1, 1, THREE.RGBAFormat);
    flow.needsUpdate = true;

    const material = await renderWithFlowmap(flow);

    expect(material.anisotropyMap).toBeTruthy();
    const data = (material.anisotropyMap!.image as { data: Uint8Array }).data;
    // Strength repacked from Godot ALPHA (200) into three.js BLUE.
    expect(data[2]).toBe(200);
    // Direction channels pass through unchanged.
    expect(data[0]).toBe(128);
    expect(data[1]).toBe(128);
    // The cached source texture must NOT be mutated in place (would clobber
    // every other consumer of that flowmap) — its blue stays 0.
    expect((flow.image as { data: Uint8Array }).data[2]).toBe(0);
  });

  it('keeps scalar anisotropy when the flowmap pixels cannot be read', async () => {
    // An image-backed texture (what THREE.TextureLoader produces for a real PNG)
    // needs a canvas readback, and this environment has no rasterizer. The
    // material must then carry NO map rather than a wrong-channel one: strength
    // survives, the per-pixel modulation is simply absent.
    const undecodable = new THREE.Texture({ width: 4, height: 4 } as HTMLImageElement);

    const material = await renderWithFlowmap(undecodable);

    expect(material.anisotropyMap).toBeNull();
    expect(material.anisotropy).toBeCloseTo(0.8, 5);
  });
});
