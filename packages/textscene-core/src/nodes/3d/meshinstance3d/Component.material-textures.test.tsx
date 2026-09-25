/**
 * Each StandardMaterial3D texture slot's loaded THREE.Texture lands on the
 * matching map of <meshStandardMaterial>. UV transforms applying to every map
 * live in `Component.material-uv.test.tsx`.
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
const HEIGHT_PATH = 'res://textures/height.png';

function extRef(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

async function renderWithTexture(opts: {
  matData: Record<string, string | undefined>;
  externals: TscnExternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
}) {
  const fake = createFakeResourceLoader();
  for (const { path, texture } of opts.cached ?? []) {
    fake.textures.seed(path, texture === 'missing' ? null : texture);
  }

  const node = makeNode();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
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
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
  });

  it('#33 albedo_texture missing → magenta placeholder material, no map', async () => {
    const renderer = await renderWithTexture({
      matData: { albedo_texture: 'ExtResource("1_tex")' },
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: 'missing' }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
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
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(mat.normalMap).toBeInstanceOf(THREE.Texture);
  });

  it('heightmap_texture loaded → material.displacementMap is a THREE.Texture (+ scale)', async () => {
    // displacementScale alone displaces nothing: the height texture must reach
    // material.displacementMap.
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: {
        heightmap_enabled: 'true',
        heightmap_texture: 'ExtResource("6_hgt")',
        heightmap_scale: '0.3',
      },
      externals: [extRef('6_hgt', HEIGHT_PATH)],
      cached: [{ path: HEIGHT_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(mat.displacementMap).toBeInstanceOf(THREE.Texture);
    expect(mat.displacementScale).toBeCloseTo(0.3, 5);
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
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
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
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(mat.roughnessMap).toBeInstanceOf(THREE.Texture);
  });

  it('#37 metallic_texture loaded → material.metalnessMap is a THREE.Texture', async () => {
    const tex = makeTexture();
    const renderer = await renderWithTexture({
      matData: { metallic_texture: 'ExtResource("4_m")' },
      externals: [extRef('4_m', METALLIC_PATH)],
      cached: [{ path: METALLIC_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
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
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
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
    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
    expect(mat.normalMap).toBeInstanceOf(THREE.Texture);
    expect(mat.roughnessMap).toBeInstanceOf(THREE.Texture);
    expect(mat.metalnessMap).toBeInstanceOf(THREE.Texture);
    expect(mat.emissiveMap).toBeInstanceOf(THREE.Texture);
  });

  // The chain surface_material_override/0 → SubResource StandardMaterial3D → ExtResource
  // Texture2D reaches `material.map`, with no `material_override` set.
  it('WI-R3F-11 surface_material_override/0 → albedo_texture lands on material.map', async () => {
    const tex = makeTexture();
    const fake = createFakeResourceLoader();
    fake.textures.seed(TEXTURE_PATH, tex);

    const surfaceMap = new Map<number, string>([[0, 'SubResource("Mat")']]);
    const node: TscnNode = {
      name: 'SurfacePlane',
      type: 'MeshInstance3D',
      children: [],
      properties: {
        name: 'SurfacePlane',
        mesh: 'SubResource("Plane_1")',
        // No `materialOverride`: only the surface slot.
        surfaceMaterialOverrides: surfaceMap,
      } as MeshInstance3DProperties,
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[
            sub('PlaneMesh', 'Plane_1', { size: 'Vector2(2, 2)' }),
            sub('StandardMaterial3D', 'Mat', {
              albedo_texture: 'ExtResource("1_tex")',
            }),
          ]}
          externalResources={[extRef('1_tex', TEXTURE_PATH)]}
        >
          <MeshInstance3D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const mat = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
  });

  // Production loads every texture asynchronously, so the empty cache, then the
  // `loaded` emit, then the re-render is the real path, which a seeded cache skips.
  it('WI-R3F-11 async texture load (cache empty on first render) → material.map binds after load event', async () => {
    const fake = createFakeResourceLoader();
    // Nothing seeded: the texture arrives through the bus after the first render.

    const surfaceMap = new Map<number, string>([[0, 'SubResource("Mat")']]);
    const node: TscnNode = {
      name: 'AsyncPlane',
      type: 'MeshInstance3D',
      children: [],
      properties: {
        name: 'AsyncPlane',
        mesh: 'SubResource("Plane_1")',
        surfaceMaterialOverrides: surfaceMap,
      } as MeshInstance3DProperties,
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[
            sub('PlaneMesh', 'Plane_1', { size: 'Vector2(2, 2)' }),
            sub('StandardMaterial3D', 'Mat', {
              albedo_texture: 'ExtResource("1_tex")',
            }),
          ]}
          externalResources={[extRef('1_tex', TEXTURE_PATH)]}
        >
          <MeshInstance3D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    // First render: useResource still pending; material has no map.
    const matBefore = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(matBefore.map).toBeNull();

    // The file pipeline emits `loaded` once createTextureFromBuffer has decoded the file.
    const tex = makeTexture();
    await ReactThreeTestRenderer.act(async () => {
      fake.eventBus.emit<THREE.Texture>('texture', 'loaded', TEXTURE_PATH, tex);
    });

    const matAfter = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(matAfter.map).toBeInstanceOf(THREE.Texture);
  });
});
