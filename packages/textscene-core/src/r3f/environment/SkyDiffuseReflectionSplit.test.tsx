/**
 * The sky diffuse/reflection split: every standard material gets
 * `envMapIntensity = contribution + metalness · (1 − contribution)` and its own `envMap`, late
 * arrivals included, and gets back what it held when the split ends. A still scene is neither
 * walked nor written each frame.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {
  SkyDiffuseReflectionSplit,
  splitSkyDiffuse,
  type EnvMapOriginal,
} from './SkyDiffuseReflectionSplit';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Written only by `mount`, emptied after each test so no frame loop outlives its test. */
const mounted: Renderer[] = [];

afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

function standardMesh(metalness = 0): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ metalness }));
}

function materialOf(mesh: THREE.Mesh): THREE.MeshStandardMaterial {
  return mesh.material as THREE.MeshStandardMaterial;
}

/** Mounts the split over a scene that already has `meshes` and an environment texture. */
async function mount(
  meshes: THREE.Object3D[],
  props: { contribution: number; active: boolean }
): Promise<{ renderer: Renderer; scene: THREE.Scene; environment: THREE.Texture }> {
  const renderer = await ReactThreeTestRenderer.create(<SkyDiffuseReflectionSplit {...props} />);
  mounted.push(renderer);
  const scene = renderer.scene.instance as unknown as THREE.Scene;
  const environment = new THREE.Texture();
  scene.environment = environment;
  if (meshes.length > 0) scene.add(...meshes);
  return { renderer, scene, environment };
}

describe('<SkyDiffuseReflectionSplit>', () => {
  it('gives a dielectric the contribution and a metal the whole sky, through its own envMap', async () => {
    const dielectric = standardMesh(0);
    const halfMetal = standardMesh(0.5);
    const metal = standardMesh(1);
    const { renderer, environment } = await mount([dielectric, halfMetal, metal], {
      contribution: 0.25,
      active: true,
    });
    await renderer.advanceFrames(1, 16);

    expect(materialOf(dielectric).envMapIntensity).toBeCloseTo(0.25, 10);
    expect(materialOf(halfMetal).envMapIntensity).toBeCloseTo(0.625, 10);
    expect(materialOf(metal).envMapIntensity).toBeCloseTo(1, 10);
    for (const mesh of [dielectric, halfMetal, metal]) {
      expect(materialOf(mesh).envMap).toBe(environment);
    }
  });

  it('touches nothing at a contribution of 1, or while inactive', async () => {
    const full = standardMesh();
    const { renderer: fullRenderer } = await mount([full], { contribution: 1, active: true });
    await fullRenderer.advanceFrames(2, 16);
    expect(materialOf(full).envMap).toBeNull();
    expect(materialOf(full).envMapIntensity).toBe(1);

    const inactive = standardMesh();
    const { renderer, scene } = await mount([inactive], { contribution: 0, active: false });
    const traverse = vi.spyOn(scene, 'traverse');
    await renderer.advanceFrames(2, 16);
    expect(materialOf(inactive).envMap).toBeNull();
    expect(traverse).not.toHaveBeenCalled();
  });

  it('waits for the scene to have an environment', async () => {
    const mesh = standardMesh();
    const { renderer, scene, environment } = await mount([mesh], { contribution: 0, active: true });
    scene.environment = null;
    await renderer.advanceFrames(1, 16);
    expect(materialOf(mesh).envMap).toBeNull();

    scene.environment = environment;
    await renderer.advanceFrames(1, 16);
    expect(materialOf(mesh).envMap).toBe(environment);
  });

  it('walks the scene once while nothing is added or removed', async () => {
    const { renderer, scene } = await mount([standardMesh()], { contribution: 0, active: true });
    const traverse = vi.spyOn(scene, 'traverse');
    await renderer.advanceFrames(30, 16);
    expect(traverse).toHaveBeenCalledTimes(1);
  });

  it('stamps a mesh that arrives after the first frame, deep in the tree', async () => {
    const { renderer, scene, environment } = await mount([], { contribution: 0.5, active: true });
    await renderer.advanceFrames(1, 16);

    const group = new THREE.Group();
    const late = standardMesh(1);
    group.add(late);
    scene.add(group);
    await renderer.advanceFrames(1, 16);
    expect(materialOf(late).envMap).toBe(environment);
    expect(materialOf(late).envMapIntensity).toBe(1);
  });

  it('stamps a material swapped onto an existing mesh, with no walk', async () => {
    const mesh = standardMesh();
    const { renderer, scene, environment } = await mount([mesh], {
      contribution: 0,
      active: true,
    });
    await renderer.advanceFrames(1, 16);
    const traverse = vi.spyOn(scene, 'traverse');

    const swapped = new THREE.MeshStandardMaterial({ metalness: 1 });
    mesh.material = swapped;
    await renderer.advanceFrames(1, 16);
    expect(swapped.envMap).toBe(environment);
    expect(swapped.envMapIntensity).toBe(1);
    expect(traverse).not.toHaveBeenCalled();
  });

  it('restores what each material held when it unmounts', async () => {
    const mesh = standardMesh();
    materialOf(mesh).envMapIntensity = 0.7;
    const { renderer } = await mount([mesh], { contribution: 0, active: true });
    await renderer.advanceFrames(1, 16);
    expect(materialOf(mesh).envMapIntensity).toBe(0);

    await renderer.unmount();
    expect(materialOf(mesh).envMap).toBeNull();
    expect(materialOf(mesh).envMapIntensity).toBe(0.7);
  });

  it('restores and re-stamps when the contribution changes', async () => {
    const mesh = standardMesh();
    const { renderer } = await mount([mesh], { contribution: 0, active: true });
    await renderer.advanceFrames(1, 16);
    expect(materialOf(mesh).envMapIntensity).toBe(0);

    await renderer.update(<SkyDiffuseReflectionSplit contribution={0.5} active />);
    expect(materialOf(mesh).envMapIntensity).toBe(1);
    await renderer.advanceFrames(1, 16);
    expect(materialOf(mesh).envMapIntensity).toBe(0.5);
  });
});

describe('splitSkyDiffuse', () => {
  const environment = new THREE.Texture();

  it('stamps every entry of a multi-material holder and records each original once', () => {
    const first = new THREE.MeshStandardMaterial();
    const second = new THREE.MeshPhysicalMaterial({ metalness: 1 });
    const holder = new THREE.Mesh(new THREE.BufferGeometry(), [first, second]);
    const originals = new Map<THREE.MeshStandardMaterial, EnvMapOriginal>();

    splitSkyDiffuse([holder], environment, 0.2, originals);
    splitSkyDiffuse([holder], environment, 0.2, originals);
    expect(first.envMapIntensity).toBeCloseTo(0.2, 10);
    expect(second.envMapIntensity).toBeCloseTo(1, 10);
    expect([...originals.values()]).toEqual([
      { envMap: null, intensity: 1 },
      { envMap: null, intensity: 1 },
    ]);
  });

  it('leaves a material with no envMapIntensity alone', () => {
    const basic = new THREE.MeshBasicMaterial();
    const originals = new Map<THREE.MeshStandardMaterial, EnvMapOriginal>();
    splitSkyDiffuse([new THREE.Mesh(new THREE.BufferGeometry(), basic)], environment, 0, originals);
    expect(basic.envMap).toBeNull();
    expect(originals.size).toBe(0);
  });

  it('writes nothing to a material that already holds its stamp', () => {
    const material = new THREE.MeshStandardMaterial();
    const holder = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const originals = new Map<THREE.MeshStandardMaterial, EnvMapOriginal>();
    splitSkyDiffuse([holder], environment, 0.3, originals);

    const writes = countWrites(material, ['envMap', 'envMapIntensity']);
    splitSkyDiffuse([holder], environment, 0.3, originals);
    expect(writes()).toBe(0);
  });

  it('re-stamps after a metalness change or a new environment', () => {
    const material = new THREE.MeshStandardMaterial();
    const holder = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const originals = new Map<THREE.MeshStandardMaterial, EnvMapOriginal>();
    splitSkyDiffuse([holder], environment, 0, originals);

    material.metalness = 1;
    splitSkyDiffuse([holder], environment, 0, originals);
    expect(material.envMapIntensity).toBe(1);

    const next = new THREE.Texture();
    splitSkyDiffuse([holder], next, 0, originals);
    expect(material.envMap).toBe(next);
    expect(originals.get(material)).toEqual({ envMap: null, intensity: 1 });
  });

  it('skips a holder whose material is null', () => {
    const holder = new THREE.Mesh();
    (holder as unknown as { material: null }).material = null;
    expect(() => splitSkyDiffuse([holder], environment, 0, new Map())).not.toThrow();
  });
});

/** Counts assignments to `keys` on `target` from now on, keeping each value readable. */
function countWrites(target: object, keys: string[]): () => number {
  let writes = 0;
  for (const key of keys) {
    let value: unknown = (target as Record<string, unknown>)[key];
    Object.defineProperty(target, key, {
      get: () => value,
      set: (next: unknown) => {
        writes += 1;
        value = next;
      },
    });
  }
  return () => writes;
}
