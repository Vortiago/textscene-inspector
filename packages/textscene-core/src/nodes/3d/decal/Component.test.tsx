/**
 * Decal component tests.
 *
 * The decal renders a projection-volume wireframe (always) plus a horizontal
 * textured quad once `texture_albedo` resolves. Coverage: the box gizmo is
 * present with and without a texture; the quad appears only when the albedo
 * loads; modulate + albedo_mix drive the quad material; the quad is sized to
 * the box footprint; the missing-texture edge falls back to the box alone.
 */

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Decal } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import { parseDecal } from './parser';

const TEXTURE_PATH = 'res://textures/decal.png';

function makeTexture(width = 64, height = 64): THREE.Texture {
  const t = new THREE.Texture();
  (t as unknown as { image: { width: number; height: number } }).image = { width, height };
  return t;
}

function makeNode(props: Record<string, string> = {}, name = 'MyDecal'): TscnNode {
  return {
    name,
    type: 'Decal',
    children: [],
    properties: parseDecal({ type: 'node', attributes: { type: 'Decal', name } }, props),
  };
}

function extRef(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

async function render(opts: {
  node: TscnNode;
  externals?: TscnExternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
  children?: ReactNode;
}) {
  const fake = createFakeResourceLoader();
  for (const { path, texture } of opts.cached ?? []) {
    fake.textures.seed(path, texture === 'missing' ? null : texture);
  }
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={opts.externals ?? []}>
        <Decal node={opts.node}>{opts.children}</Decal>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<Decal>', () => {
  it('always renders a projection-box wireframe (LineSegments), even without a texture', async () => {
    const renderer = await render({ node: makeNode() });
    expect(renderer.scene.findAllByType('LineSegments').length).toBe(1);
  });

  it('renders a textured quad when the albedo texture loads', async () => {
    const tex = makeTexture();
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as THREE.MeshBasicMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
  });

  it('sizes the projected quad to the box footprint (size.x × size.z)', async () => {
    const tex = makeTexture();
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")', size: 'Vector3(3, 2, 4)' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const geom = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
      parameters: { width: number; height: number };
    };
    expect(geom.parameters.width).toBeCloseTo(3, 5);
    expect(geom.parameters.height).toBeCloseTo(4, 5);
  });

  it('folds albedo_mix × modulate.a into the quad opacity and tints with modulate', async () => {
    const tex = makeTexture();
    const renderer = await render({
      node: makeNode({
        texture_albedo: 'ExtResource("1_tex")',
        modulate: 'Color(1, 0, 0, 0.8)',
        albedo_mix: '0.5',
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.MeshBasicMaterial;
    // opacity = clamp01(0.5 * 0.8) = 0.4
    expect(mat.opacity).toBeCloseTo(0.4, 5);
    expect(mat.transparent).toBe(true);
    // modulate red, sRGB→linear: r stays 1, g/b stay 0.
    expect(mat.color.r).toBeCloseTo(1, 3);
    expect(mat.color.g).toBeCloseTo(0, 3);
  });

  it('renders the box alone (no textured quad) when the texture is missing', async () => {
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }, 'Missing'),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: 'missing' }],
    });
    expect(renderer.scene.findAllByType('LineSegments').length).toBe(1);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });

  it('renders the box alone when no texture_albedo is set', async () => {
    const renderer = await render({ node: makeNode() });
    expect(renderer.scene.findAllByType('LineSegments').length).toBe(1);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });

  it('applies the Node3D transform and wraps children', async () => {
    const renderer = await render({
      node: {
        ...makeNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 1, -2)' }, 'Placed'),
        children: [],
      },
    });
    const group = renderer.scene.findByProps({ name: 'Placed' });
    expect(group.instance.position.x).toBe(5);
    expect(group.instance.position.z).toBe(-2);
  });

  it('renders children passed to the component', async () => {
    const renderer = await render({
      node: makeNode(),
      children: (
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      ),
    });
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
