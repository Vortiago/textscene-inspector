/**
 * Render-side contract for StandardMaterial3D refraction.
 *
 * Parsing transmission/thickness is necessary but not sufficient — the values
 * have to reach the rendered material. three.js exposes transmission only on
 * `MeshPhysicalMaterial` (like clearcoat / sheen / anisotropy), so a
 * refraction-bearing StandardMaterial3D must upgrade the slot to a
 * `<meshPhysicalMaterial>` carrying `transmission` + `thickness` (with `ior` at
 * three's glass default 1.5). Every non-refraction material stays on the
 * lighter `MeshStandardMaterial` — the type the rest of the suite asserts on.
 *
 * (No texture is involved: `refraction_texture` is a documented follow-up, out
 * of this slice's scope — see the parse test's PARITY note.)
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

/** Provider that never loads anything — these materials carry no textures. */
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
    const loader = makeLoader();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      {
        id: 'mat',
        type: 'StandardMaterial3D',
        data: { id: 'mat', refraction_enabled: 'true', refraction_scale: '0.2' } as Record<string, string>,
      },
    ];

    const renderer = await renderWith(makeNode('mat'), internal, loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    const physical = renderer.scene.findAllByType('MeshPhysicalMaterial');
    expect(physical).toHaveLength(1);
    const material = physical[0]!.instance as THREE.Object3D & THREE.MeshPhysicalMaterial;
    expect(material.transmission).toBeCloseTo(1, 5);
    expect(material.thickness).toBeCloseTo(0.2, 5);
    // ior is left unset so it stays at three's MeshPhysicalMaterial glass
    // default (1.5) — Godot exposes no ior, so a hallucinated override would
    // silently diverge. Pin the invariant, not just the mechanism the diff set.
    expect(material.ior).toBe(1.5);
  });

  it('keeps a material with no refraction on the standard (non-physical) material', async () => {
    // GUARDRAIL: the common path must stay MeshStandardMaterial so existing
    // behaviour — and the material type every other test asserts on — is
    // unchanged; only an enabled refraction upgrades to physical.
    const loader = makeLoader();
    const internal: TscnInternalResource[] = [
      { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
      { id: 'mat', type: 'StandardMaterial3D', data: { id: 'mat', roughness: '0.4' } as Record<string, string> },
    ];

    const renderer = await renderWith(makeNode('mat'), internal, loader);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(renderer.scene.findAllByType('MeshPhysicalMaterial')).toHaveLength(0);
    expect(renderer.scene.findAllByType('MeshStandardMaterial')).toHaveLength(1);
  });
});
