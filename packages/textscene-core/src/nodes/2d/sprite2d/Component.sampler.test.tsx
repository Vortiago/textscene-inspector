/**
 * Tests that a Sprite2D samples its texture with the effective `texture_filter` and
 * `texture_repeat` of the CanvasItem tree (`scene/main/canvas_item.cpp:1625-1699`), and that the
 * root of the tree takes the project's canvas texture defaults (`editor/editor_node.cpp:451-460`).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseSprite2D } from './parser';
import { Sprite2D } from './Component';
import { Node2D } from '../../base/node2d/Component';
import { parseNode2D } from '../../base/node2d/parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';

const projectSettingsMock = vi.hoisted(() => ({ settings: null as Record<string, string> | null }));

vi.mock('../../../r3f/contexts/ProjectSettingsContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../r3f/contexts/ProjectSettingsContext')>()),
  useProjectSettings: () => projectSettingsMock,
}));

beforeEach(() => {
  projectSettingsMock.settings = null;
});

const TEX = 'res://sprite.png';

// CanvasItem enums (`canvas_item.h:52-69`), as a `.tscn` stores them.
const NEAREST = '1';
const LINEAR = '2';
const LINEAR_WITH_MIPMAPS = '4';
const REPEAT_ENABLED = '2';

function sprite(raw: Record<string, string> = {}): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Sprite2D', name: 'S' } };
  return {
    rawProperties: {},
    name: 'S',
    type: 'Sprite2D',
    children: [],
    properties: parseSprite2D(heading, { texture: 'ExtResource("1")', ...raw }),
  };
}

function node2d(raw: Record<string, string>): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Node2D', name: 'P' } };
  return {
    rawProperties: {},
    name: 'P',
    type: 'Node2D',
    children: [],
    properties: parseNode2D(heading, raw),
  };
}

/** A texture as the loader hands it over: imported with mipmaps, so sampled through its chain by default. */
function mipmappedImage(): THREE.Texture {
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 8, height: 8 };
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** Renders `leaf`, inside `parent` when given, and returns the map its mesh draws with. */
async function drawnMap(leaf: TscnNode, parent?: TscnNode): Promise<THREE.Texture> {
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEX, mipmappedImage());
  const tree = parent ? (
    <Node2D node={parent}>
      <Sprite2D node={leaf} />
    </Node2D>
  ) : (
    <Sprite2D node={leaf} />
  );
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
      >
        {tree}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return (mesh.material as THREE.MeshBasicMaterial).map!;
}

describe('Sprite2D texture sampler', () => {
  it('samples nearest with no mipmaps under a Node2D parent that sets Nearest', async () => {
    const map = await drawnMap(sprite(), node2d({ texture_filter: NEAREST }));
    expect([map.magFilter, map.minFilter, map.generateMipmaps]).toEqual([
      THREE.NearestFilter,
      THREE.NearestFilter,
      false,
    ]);
  });

  it('samples linear with no mipmaps by default, though the loaded texture has a chain', async () => {
    // The viewport default is Linear, whose sampler sets `max_lod = 0` (`material_storage.cpp:2472-2476`).
    const map = await drawnMap(sprite());
    expect([map.magFilter, map.minFilter, map.generateMipmaps]).toEqual([
      THREE.LinearFilter,
      THREE.LinearFilter,
      false,
    ]);
  });

  it('lets its own filter beat the parent', async () => {
    const map = await drawnMap(sprite({ texture_filter: LINEAR }), node2d({ texture_filter: NEAREST }));
    expect(map.magFilter).toBe(THREE.LinearFilter);
  });

  it('reads the mip chain under Linear Mipmaps', async () => {
    const map = await drawnMap(sprite({ texture_filter: LINEAR_WITH_MIPMAPS }));
    expect([map.minFilter, map.generateMipmaps]).toEqual([THREE.LinearMipmapLinearFilter, true]);
  });

  it('samples nearest when the project setting default_texture_filter is Nearest, with nothing set on the nodes', async () => {
    projectSettingsMock.settings = { 'rendering/textures/canvas_textures/default_texture_filter': '0' };
    const map = await drawnMap(sprite());
    expect(map.magFilter).toBe(THREE.NearestFilter);
  });

  it('wraps with RepeatWrapping when texture_repeat is Enabled on a parent, and clamps otherwise', async () => {
    const repeated = await drawnMap(sprite(), node2d({ texture_repeat: REPEAT_ENABLED }));
    expect([repeated.wrapS, repeated.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
    const clamped = await drawnMap(sprite());
    expect([clamped.wrapS, clamped.wrapT]).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping]);
  });
});
