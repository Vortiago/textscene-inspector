/**
 * Strict-verification harness (group E) — 8 assertions covering
 * StandardMaterial3D UV transforms (uv1_scale, uv1_offset). The bug-catcher
 * here is #47: UV must apply to ALL active texture maps, not just albedo.
 *
 * Assertions: 40–47 of `docs/archive/STRICT-VERIFICATION.md`.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

function makeLoader() {
  const fake = createFakeResourceLoader();
  return {
    loader: fake.loader,
    setTextureCached: (p: string, t: THREE.Texture) => fake.textures.seed(p, t),
  };
}

function makeNode(): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'M',
    surfaceMaterialOverrides: new Map(),
    mesh: 'SubResource("Box_1")',
    materialOverride: 'SubResource("Mat")',
  };
  return { name: 'M', type: 'MeshInstance3D', children: [], properties: props };
}

function sub(
  type: string,
  id: string,
  data: Record<string, string | undefined>
): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

function ext(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

async function renderUV(opts: {
  matData: Record<string, string | undefined>;
  externals: TscnExternalResource[];
  cached: Array<{ path: string; texture: THREE.Texture }>;
}) {
  const { loader, setTextureCached } = makeLoader();
  for (const { path, texture } of opts.cached) setTextureCached(path, texture);

  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={[
          sub('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
          sub('StandardMaterial3D', 'Mat', opts.matData),
        ]}
        externalResources={opts.externals}
      >
        <MeshInstance3D node={makeNode()} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
}

const A_PATH = 'res://a.png';
const N_PATH = 'res://n.png';
const R_PATH = 'res://r.png';
const M_PATH = 'res://m.png';
const E_PATH = 'res://e.png';

function tex(): THREE.Texture {
  return new THREE.Texture();
}

describe('StandardMaterial3D UV transforms (assertions 40–47)', () => {
  it('#40 uv1_scale.x=2 → material.map.repeat.x === 2', async () => {
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_scale: 'Vector3(2, 1, 1)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat.map?.repeat.x).toBe(2);
  });

  it('#41 uv1_scale.y=3 → material.map.repeat.y === 3', async () => {
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_scale: 'Vector3(1, 3, 1)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat.map?.repeat.y).toBe(3);
  });

  it('#42 uv1_scale.z component ignored — no throw', async () => {
    // THREE.Texture has no z-axis repeat. Just ensure render doesn't throw
    // when a non-trivial z is supplied. We assert by reaching the
    // post-render state (mat is defined) without a thrown error.
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_scale: 'Vector3(2, 2, 5)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat).toBeDefined();
  });

  it('#43 uv1_offset.x=0.25 → material.map.offset.x === 0.25', async () => {
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_offset: 'Vector3(0.25, 0, 0)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat.map?.offset.x).toBeCloseTo(0.25, 5);
  });

  it('#44 uv1_offset.y=0.5 → material.map.offset.y === 0.5', async () => {
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_offset: 'Vector3(0, 0.5, 0)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat.map?.offset.y).toBeCloseTo(0.5, 5);
  });

  it('#45 uv1_scale = 0 → repeat is 0 (not default 1) and no divide-by-zero', async () => {
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_scale: 'Vector3(0, 0, 1)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat.map?.repeat.x).toBe(0);
    expect(mat.map?.repeat.y).toBe(0);
  });

  it('#46 negative uv1_scale → repeat is negative (flip) — no error', async () => {
    const mat = await renderUV({
      matData: { albedo_texture: 'ExtResource("1")', uv1_scale: 'Vector3(-1, -1, 1)' },
      externals: [ext('1', A_PATH)],
      cached: [{ path: A_PATH, texture: tex() }],
    });
    expect(mat.map?.repeat.x).toBe(-1);
    expect(mat.map?.repeat.y).toBe(-1);
  });

  it('#47 uv1_scale applies to ALL active texture maps (the user-caught bug)', async () => {
    const mat = await renderUV({
      matData: {
        albedo_texture: 'ExtResource("1")',
        normal_enabled: 'true',
        normal_texture: 'ExtResource("2")',
        roughness_texture: 'ExtResource("3")',
        metallic_texture: 'ExtResource("4")',
        emission_enabled: 'true',
        emission: 'Color(1, 1, 1, 1)',
        emission_texture: 'ExtResource("5")',
        uv1_scale: 'Vector3(4, 4, 1)',
      },
      externals: [
        ext('1', A_PATH),
        ext('2', N_PATH),
        ext('3', R_PATH),
        ext('4', M_PATH),
        ext('5', E_PATH),
      ],
      cached: [
        { path: A_PATH, texture: tex() },
        { path: N_PATH, texture: tex() },
        { path: R_PATH, texture: tex() },
        { path: M_PATH, texture: tex() },
        { path: E_PATH, texture: tex() },
      ],
    });
    expect(mat.map?.repeat.x).toBe(4);
    expect(mat.normalMap?.repeat.x).toBe(4);
    expect(mat.roughnessMap?.repeat.x).toBe(4);
    expect(mat.metalnessMap?.repeat.x).toBe(4);
    expect(mat.emissiveMap?.repeat.x).toBe(4);
  });
});
