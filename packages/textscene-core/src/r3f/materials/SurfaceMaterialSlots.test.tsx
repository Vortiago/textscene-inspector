/**
 * How `SurfaceMaterialSlots` attaches one slot per draw group: a material array for
 * many surfaces, one material for a single surface, and Godot's default surface for none.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { GODOT_DEFAULT_ROUGHNESS } from './godotDefaultMaterial';
import type { MaterialSource } from './materialSource';
import { SurfaceMaterialSlots } from './SurfaceMaterialSlots';

const SCENE: TscnInternalResource[] = [
  { id: 'Mat_red', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Mat_blue', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
];

function inline(resource: TscnInternalResource): MaterialSource {
  return { kind: 'inline', material: { resource, internalResources: SCENE, externalResources: [] } };
}

const RED = inline(SCENE[0]!);
const BLUE = inline(SCENE[1]!);

async function renderedMaterial(sources: readonly (MaterialSource | undefined)[]) {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={SCENE} externalResources={[]}>
        <mesh>
          <boxGeometry />
          <SurfaceMaterialSlots sources={sources} />
        </mesh>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material;
}

describe('<SurfaceMaterialSlots>', () => {
  it('attaches each surface its own material, in draw-group order', async () => {
    const materials = (await renderedMaterial([RED, BLUE])) as THREE.MeshStandardMaterial[];
    expect(materials.map((m) => m.color.getHex())).toEqual([0xff0000, 0x0000ff]);
  });

  it('keeps one surface as one material rather than a length-1 array', async () => {
    const material = await renderedMaterial([RED]);
    expect(Array.isArray(material)).toBe(false);
    expect((material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
  });

  it("draws Godot's default material for a surface with no source", async () => {
    const [unset, blue] = (await renderedMaterial([undefined, BLUE])) as THREE.MeshStandardMaterial[];
    expect(unset!.roughness).toBeCloseTo(GODOT_DEFAULT_ROUGHNESS, 5);
    expect(blue!.color.getHex()).toBe(0x0000ff);
  });

  it("draws Godot's default surface for a mesh that declares no surfaces", async () => {
    const material = await renderedMaterial([]);
    expect(Array.isArray(material)).toBe(false);
    expect((material as THREE.MeshStandardMaterial).roughness).toBeCloseTo(GODOT_DEFAULT_ROUGHNESS, 5);
  });
});
