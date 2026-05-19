/**
 * Strict-verification harness (WI-R3F-9, group D) — 8 assertions covering
 * StandardMaterial3D texture slots. The key question for each slot is
 * "did the loaded THREE.Texture actually land on the corresponding map
 * property of <meshStandardMaterial>?".
 *
 * Assertions: 32–39 of `work_items/STRICT-VERIFICATION.md`.
 *
 * #47 (UV applies to ALL maps) lives in `Component.material-uv.test.tsx`.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { MetadataStore } from '../../../resources/MetadataStore';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from '../../../nodes/3d/meshinstance3d/types';

/**
 * Minimal mock ResourceLoader for the texture path. Lets a test pre-seed
 * cached THREE.Textures keyed by path so `useResource('texture')` returns
 * status=loaded synchronously on first render.
 */
function makeLoader(): {
  loader: ResourceLoader;
  setTextureCached: (path: string, tex: THREE.Texture) => void;
  setTextureMissing: (path: string) => void;
} {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const textureCache = new Map<string, THREE.Texture | null>();
  const materialCache = new Map<string, THREE.Material | null>();
  const glbCache = new Map<string, THREE.Object3D | null>();

  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: (p?: string) => (p ? cache.delete(p) : cache.clear()),
    getCacheSize: () => cache.size,
  });

  const loader = {
    eventBus,
    metadata,
    textures: makeProc<THREE.Texture>(textureCache),
    materials: makeProc<THREE.Material>(materialCache),
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    getSceneCached: () => undefined,
    requestScene: () => {},
    provideFile: () => {},
    clear: () => {
      textureCache.clear();
      materialCache.clear();
      glbCache.clear();
      eventBus.clear();
      metadata.clear();
    },
  } as unknown as ResourceLoader;

  return {
    loader,
    setTextureCached: (p, t) => textureCache.set(p, t),
    setTextureMissing: (p) => textureCache.set(p, null),
  };
}

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'M',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    mesh: properties.mesh ?? 'SubResource("Box_1")',
    materialOverride: properties.materialOverride ?? 'SubResource("Mat")',
    ...properties,
  };
  return { name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

function sub(
  type: string,
  id: string,
  data: Record<string, string | undefined> = {}
): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

const TEXTURE_PATH = 'res://textures/albedo.png';
const NORMAL_PATH = 'res://textures/normal.png';
const ROUGHNESS_PATH = 'res://textures/rough.png';
const METALLIC_PATH = 'res://textures/metal.png';
const EMISSION_PATH = 'res://textures/emit.png';

function extRef(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

async function renderWithTexture(opts: {
  matData: Record<string, string | undefined>;
  externals: TscnExternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
}) {
  const { loader, setTextureCached, setTextureMissing } = makeLoader();
  for (const { path, texture } of opts.cached ?? []) {
    if (texture === 'missing') setTextureMissing(path);
    else setTextureCached(path, texture);
  }

  const node = makeNode();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={[
          sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
          sub('StandardMaterial3D', 'Mat', opts.matData),
        ]}
        externalResources={opts.externals}
      >
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return renderer;
}

function makeTexture(): THREE.Texture {
  const t = new THREE.Texture();
  t.needsUpdate = false;
  return t;
}

describe('StandardMaterial3D textures (assertions 32–39)', () => {
  it('#32 albedo_texture loaded → material.map is a THREE.Texture', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: { albedo_texture: 'ExtResource("1_tex")' },
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
  });

  it('#33 albedo_texture missing → magenta placeholder material, no map', async () => {
    const renderer = await renderWithTexture({
      matData: { albedo_texture: 'ExtResource("1_tex")' },
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: 'missing' }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.color.r).toBeCloseTo(1, 1);
    expect(mat.color.g).toBeCloseTo(0, 1);
    expect(mat.color.b).toBeCloseTo(1, 1);
    expect(mat.map).toBeNull();
  });

  it('#34 normal_texture loaded → material.normalMap is a THREE.Texture', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: { normal_enabled: 'true', normal_texture: 'ExtResource("2_nrm")' },
      externals: [extRef('2_nrm', NORMAL_PATH)],
      cached: [{ path: NORMAL_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.normalMap).toBeInstanceOf(THREE.Texture);
  });

  it('#35 normal_scale=2.0 → material.normalScale.x === 2.0 and .y === 2.0', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: {
        normal_enabled: 'true',
        normal_texture: 'ExtResource("2_nrm")',
        normal_scale: '2.0',
      },
      externals: [extRef('2_nrm', NORMAL_PATH)],
      cached: [{ path: NORMAL_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.normalScale.x).toBe(2.0);
    expect(mat.normalScale.y).toBe(2.0);
  });

  it('#36 roughness_texture loaded → material.roughnessMap is a THREE.Texture', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: { roughness_texture: 'ExtResource("3_r")' },
      externals: [extRef('3_r', ROUGHNESS_PATH)],
      cached: [{ path: ROUGHNESS_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.roughnessMap).toBeInstanceOf(THREE.Texture);
  });

  it('#37 metallic_texture loaded → material.metalnessMap is a THREE.Texture', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: { metallic_texture: 'ExtResource("4_m")' },
      externals: [extRef('4_m', METALLIC_PATH)],
      cached: [{ path: METALLIC_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.metalnessMap).toBeInstanceOf(THREE.Texture);
  });

  it('#38 emission_texture loaded → material.emissiveMap is a THREE.Texture', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: {
        emission_enabled: 'true',
        emission: 'Color(1, 1, 1, 1)',
        emission_texture: 'ExtResource("5_e")',
      },
      externals: [extRef('5_e', EMISSION_PATH)],
      cached: [{ path: EMISSION_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.emissiveMap).toBeInstanceOf(THREE.Texture);
  });

  it('#39 all five texture slots present → all five map slots populated on material', async () => {
    const albedo = makeTexture();
    const normal = makeTexture();
    const rough = makeTexture();
    const metal = makeTexture();
    const emit = makeTexture();
    const renderer = await renderWithTexture({
      matData: {
        albedo_texture: 'ExtResource("1_t")',
        normal_enabled: 'true',
        normal_texture: 'ExtResource("2_n")',
        roughness_texture: 'ExtResource("3_r")',
        metallic_texture: 'ExtResource("4_m")',
        emission_enabled: 'true',
        emission: 'Color(1, 1, 1, 1)',
        emission_texture: 'ExtResource("5_e")',
      },
      externals: [
        extRef('1_t', TEXTURE_PATH),
        extRef('2_n', NORMAL_PATH),
        extRef('3_r', ROUGHNESS_PATH),
        extRef('4_m', METALLIC_PATH),
        extRef('5_e', EMISSION_PATH),
      ],
      cached: [
        { path: TEXTURE_PATH, texture: albedo },
        { path: NORMAL_PATH, texture: normal },
        { path: ROUGHNESS_PATH, texture: rough },
        { path: METALLIC_PATH, texture: metal },
        { path: EMISSION_PATH, texture: emit },
      ],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
    expect(mat.normalMap).toBeInstanceOf(THREE.Texture);
    expect(mat.roughnessMap).toBeInstanceOf(THREE.Texture);
    expect(mat.metalnessMap).toBeInstanceOf(THREE.Texture);
    expect(mat.emissiveMap).toBeInstanceOf(THREE.Texture);
  });
});
