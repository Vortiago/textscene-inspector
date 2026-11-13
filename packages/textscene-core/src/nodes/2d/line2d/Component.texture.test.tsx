/**
 * <Line2D> with a `texture`: the strip carries Godot's UVs, the material samples the texture, and
 * the item's `texture_repeat` decides the wrap. The texture is 64 by 32, so `tile_aspect` is 2.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Line2D } from './Component';
import { parseLine2D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import type { ParsedHeading } from '../../../parser/utils';
import type { TscnNode } from '../../../parser/types';
import {
  UNSET_VIEWPORT_TEXTURE,
  UNSET_VIEWPORT_TEXTURE_REF,
} from '../../../resources/textures/viewporttexture/unsetViewportTexture.testkit';

const TEXTURE_PATH = 'res://stripes.png';
const TEXTURE_WIDTH = 64;
const TEXTURE_HEIGHT = 32;
const TILE = '1';
const STRETCH = '2';

function lineNode(rawProps: Record<string, string>): TscnNode {
  const heading: ParsedHeading = { type: 'node', attributes: { name: 'Line', type: 'Line2D' } };
  return {
    rawProperties: {},
    name: 'Line',
    type: 'Line2D',
    children: [],
    properties: parseLine2D(heading, {
      points: 'PackedVector2Array(0, 0, 128, 0)',
      width: '16.0',
      texture: 'ExtResource("1")',
      ...rawProps,
    }),
  };
}

async function render(rawProps: Record<string, string>, { loaded = true } = {}) {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  Object.assign(texture, { image: { width: TEXTURE_WIDTH, height: TEXTURE_HEIGHT } });
  if (loaded) fake.textures.seed(TEXTURE_PATH, texture);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
      >
        <Line2D node={lineNode(rawProps)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await settleLoads();
  return { renderer, fake, texture };
}

const strokeMesh = ({ renderer }: Awaited<ReturnType<typeof render>>) =>
  renderer.scene.findByType('Mesh').instance as THREE.Mesh;

/** The `u` of the last vertex, which sits at the end of the line. */
function endU(mesh: THREE.Mesh): number {
  const uv = mesh.geometry.getAttribute('uv');
  return uv.getX(uv.count - 1);
}

describe('<Line2D> texture', () => {
  it('binds the texture as the material map', async () => {
    const material = strokeMesh(await render({})).material as THREE.MeshBasicMaterial;
    expect(material.map).not.toBeNull();
  });

  it('draws without a map for a line with no texture', async () => {
    const rendered = await render({ texture: 'null' });
    expect((strokeMesh(rendered).material as THREE.MeshBasicMaterial).map).toBeNull();
  });

  it('puts every vertex on the top-left texel for texture_mode NONE', async () => {
    const uv = strokeMesh(await render({})).geometry.getAttribute('uv');
    // Godot's v 0 is the top row, and a three texture reads v 1 there.
    for (let i = 0; i < uv.count; i++) expect([uv.getX(i), uv.getY(i)]).toEqual([0, 1]);
  });

  it('runs u over width times the texture’s aspect for TILE, flipped to three’s v', async () => {
    const mesh = strokeMesh(await render({ texture_mode: TILE }));
    // 128 / (16 * 2) = 4 tiles.
    expect(endU(mesh)).toBe(4);
    const uv = mesh.geometry.getAttribute('uv');
    expect([uv.getY(0), uv.getY(1)]).toEqual([1, 0]);
  });

  it('runs u from 0 to 1 for STRETCH', async () => {
    expect(endU(strokeMesh(await render({ texture_mode: STRETCH })))).toBe(1);
  });

  it('rebuilds the strip when the texture arrives, with its aspect', async () => {
    const rendered = await render({ texture_mode: TILE }, { loaded: false });
    // Without a texture the aspect is 1: 128 / 16 = 8 tiles.
    expect(endU(strokeMesh(rendered))).toBe(8);

    await ReactThreeTestRenderer.act(async () => {
      rendered.fake.textures._resolve(TEXTURE_PATH, rendered.texture);
    });
    await settleLoads();
    expect(endU(strokeMesh(rendered))).toBe(4);
  });

  it('clamps the map past the first tile at the default texture_repeat', async () => {
    const map = (strokeMesh(await render({ texture_mode: TILE })).material as THREE.MeshBasicMaterial).map!;
    expect([map.wrapS, map.wrapT]).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping]);
  });

  it('repeats the map where texture_repeat is Enabled', async () => {
    const rendered = await render({ texture_mode: TILE, texture_repeat: '2' });
    const map = (strokeMesh(rendered).material as THREE.MeshBasicMaterial).map!;
    expect([map.wrapS, map.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
  });

  it('multiplies the texture by default_color', async () => {
    const rendered = await render({ default_color: 'Color(1, 0, 0, 1)' });
    const { color, map } = strokeMesh(rendered).material as THREE.MeshBasicMaterial;
    expect(map).not.toBeNull();
    expect([color.r, color.g, color.b]).toEqual([1, 0, 0]);
  });

  it('takes Godot’s NaN aspect from a texture that reports size 0, so TILE reads u as NaN', async () => {
    // 0 / 0 is NaN, which `tile_aspect <= 0` lets through (`line_builder.cpp:55`) and which
    // Godot's `Size2::aspect` gives for a ViewportTexture that was never set up.
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
        <SceneResourcesProvider internalResources={[UNSET_VIEWPORT_TEXTURE]} externalResources={[]}>
          <Line2D node={lineNode({ texture: UNSET_VIEWPORT_TEXTURE_REF, texture_mode: TILE })} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    await settleLoads();
    expect(endU(renderer.scene.findByType('Mesh').instance as THREE.Mesh)).toBeNaN();
  });
});
