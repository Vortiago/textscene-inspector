/**
 * Material processor — the join between the **Sub-resource path** grammar and
 * the `.tres` → THREE.Material builder. A surface material declared inside a
 * mesh's own `.tres` is requested by the same `request(path)` call as a
 * standalone material file; nothing above this line knows the difference.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { createMaterialProcessor } from './createMaterialProcessor';

/** Shaped like scenes/demos/3d/truck_town/vehicles/meshes/wheel.tres. */
const WHEEL_TRES = [
  '[gd_resource type="ArrayMesh" format=4 uid="uid://bqrwin8ccgptt"]',
  '',
  '[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_shvqh"]',
  'resource_name = "tire"',
  'albedo_color = Color(1, 0, 0, 1)',
  'roughness = 0.8',
  '',
  '[resource]',
  'resource_name = "meshes_wheel"',
  '_surfaces = []',
  '',
].join('\n');

const STANDALONE_TRES = [
  '[gd_resource type="StandardMaterial3D" format=3]',
  '',
  '[resource]',
  'albedo_color = Color(0, 1, 0, 1)',
  '',
].join('\n');

class MapProvider implements ResourceProvider {
  constructor(private files: Map<string, string>) {}
  loadResource = vi.fn(async (path: string): Promise<string | ArrayBuffer | null> => {
    return this.files.get(path) ?? null;
  });
}

function setup() {
  const provider = new MapProvider(
    new Map([
      ['res://vehicles/wheel.tres', WHEEL_TRES],
      ['res://materials/green.tres', STANDALONE_TRES],
    ])
  );
  const eventBus = new ResourceEventBus();
  const processor = createMaterialProcessor(new FileEventBus(provider), eventBus);
  return { provider, eventBus, processor };
}

describe('createMaterialProcessor', () => {
  it('builds a surface material declared as a sub-resource of the mesh’s own .tres', async () => {
    const { processor, eventBus } = setup();
    const address = 'res://vehicles/wheel.tres::StandardMaterial3D_shvqh';

    const loaded = eventBus.once<THREE.Material>('material', 'loaded', address, 2000);
    processor.request(address);
    const material = (await loaded) as THREE.MeshStandardMaterial;

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    // Straight off the sub-resource body: Color(1, 0, 0, 1) and roughness 0.8.
    expect(material.color.getHex()).toBe(0xff0000);
    expect(material.roughness).toBe(0.8);
    expect(processor.getCached(address)).toBe(material);
  });

  it('still builds a whole-file material from a plain path', async () => {
    const { processor, eventBus } = setup();
    const path = 'res://materials/green.tres';

    const loaded = eventBus.once<THREE.Material>('material', 'loaded', path, 2000);
    processor.request(path);
    const material = (await loaded) as THREE.MeshStandardMaterial;

    expect(material.color.getHex()).toBe(0x00ff00);
  });

  it('shares one material by identity across two requests for the same sub-resource', async () => {
    const { processor, eventBus } = setup();
    const address = 'res://vehicles/wheel.tres::StandardMaterial3D_shvqh';

    const first = await (async () => {
      const loaded = eventBus.once<THREE.Material>('material', 'loaded', address, 2000);
      processor.request(address);
      return loaded;
    })();
    const again = eventBus.once<THREE.Material>('material', 'loaded', address, 2000);
    processor.request(address);

    expect(await again).toBe(first);
  });
});
