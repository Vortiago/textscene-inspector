/**
 * The reactive arrival path end to end: a scene's inline StandardMaterial3D,
 * its textures fetched through the loader, and the colour space each slot ends
 * up sampling in.
 *
 * The rule itself lives at the binding seam
 * (`resources/materials/standardmaterial3d/textureBinding.ts`, which cites
 * Godot's `source_color` hints) and is tested there. What this file guards is
 * the WIRING: that this component names the right Godot slot for each of its
 * eight `useResource` results, so an albedo cannot be bound as a roughness map
 * or the reverse. That mistake is invisible to the binding module's own tests
 * and to a material-state comparison, because every value involved is
 * individually correct.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { findMesh } from '../testing/reactThreeTestInstance';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

/** Godot slot → the `.tres` property, the ext id, the path and the three map. */
const SLOTS = [
  ['albedo_texture', '1_alb', 'res://textures/alb.png', 'map', THREE.SRGBColorSpace],
  ['emission_texture', '2_emi', 'res://textures/emi.png', 'emissiveMap', THREE.SRGBColorSpace],
  ['normal_texture', '3_nrm', 'res://textures/nrm.png', 'normalMap', THREE.NoColorSpace],
  ['roughness_texture', '4_rgh', 'res://textures/rgh.png', 'roughnessMap', THREE.NoColorSpace],
  ['metallic_texture', '5_mtl', 'res://textures/mtl.png', 'metalnessMap', THREE.NoColorSpace],
  ['ao_texture', '6_ao', 'res://textures/ao.png', 'aoMap', THREE.NoColorSpace],
  ['heightmap_texture', '7_hgt', 'res://textures/hgt.png', 'displacementMap', THREE.NoColorSpace],
] as const;

/** As the loader hands them out: one shared entry per path, tagged sRGB. */
function loaded(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = false;
  return texture;
}

const SHARED = new Map<string, THREE.Texture>(SLOTS.map(([, , path]) => [path, loaded()]));

const MATERIAL: Record<string, string> = {
  emission_enabled: 'true',
  normal_enabled: 'true',
  ao_enabled: 'true',
  heightmap_enabled: 'true',
  ...Object.fromEntries(SLOTS.map(([slot, id]) => [slot, `ExtResource("${id}")`])),
};

const EXTERNALS: TscnExternalResource[] = SLOTS.map(([, id, path]) => ({
  id,
  type: 'Texture2D',
  path,
}));

function sub(type: string, id: string, data: Record<string, string>): TscnInternalResource {
  return { id, type, data };
}

async function renderMaterial(): Promise<THREE.MeshStandardMaterial> {
  const fake = createFakeResourceLoader();
  for (const [path, texture] of SHARED) fake.textures.seed(path, texture);

  const properties: MeshInstance3DProperties = {
    name: 'M',
    mesh: 'SubResource("Box_1")',
    materialOverride: 'SubResource("Mat")',
    surfaceMaterialOverrides: new Map(),
  };
  const node: TscnNode = {
    name: 'M',
    type: 'MeshInstance3D',
    children: [],
    properties,
  };

  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[
          sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
          sub('StandardMaterial3D', 'Mat', MATERIAL),
        ]}
        externalResources={EXTERNALS}
      >
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('MeshInstance3D — each slot binds in Godot’s colour space', () => {
  it.each(SLOTS.map(([slot, , , map, colorSpace]) => [slot, map, colorSpace]))(
    '%s → %s',
    async (_slot, map, colorSpace) => {
      const material = await renderMaterial();
      const texture = (material as unknown as Record<string, THREE.Texture | null>)[map];
      expect(texture).not.toBeNull();
      expect(texture!.colorSpace).toBe(colorSpace);
    }
  );

  it('retags clones only, leaving every shared cache entry on its own tag', async () => {
    // `useResource` hands the same texture to every consumer of a path, and one
    // of them may legitimately be sampling it as an albedo.
    await renderMaterial();
    for (const texture of SHARED.values()) {
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    }
  });

  it('pins the raw tag against R3F’s per-commit sRGB reassertion', async () => {
    const material = await renderMaterial();
    material.roughnessMap!.colorSpace = THREE.SRGBColorSpace;
    expect(material.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);
  });
});
