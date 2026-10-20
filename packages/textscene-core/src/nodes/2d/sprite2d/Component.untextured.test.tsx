/**
 * A Sprite2D with no texture draws nothing, as Godot's draw returns early (`sprite_2d.cpp:159`).
 * Only a texture that is set but cannot be loaded gets the missing-resource placeholder.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseSprite2D } from './parser';
import { Sprite2D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';

function spriteNode(raw: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'S',
    type: 'Sprite2D',
    children: [],
    properties: parseSprite2D(heading('Sprite2D', { name: 'S' }), raw),
  };
}

async function render(node: TscnNode) {
  const fake = createFakeResourceLoader();
  // The loader reports this file as failed, so the sprite's texture is set but missing.
  fake.textures.seed('res://absent.png', null);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: '1', type: 'Texture2D', path: 'res://absent.png' }]}
      >
        <Sprite2D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return renderer;
}

function placeholders(renderer: Awaited<ReturnType<typeof render>>) {
  return renderer.scene.findAllByType('Mesh').filter((m) => {
    const material = (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    return material.color.getHex() === new THREE.Color('magenta').getHex();
  });
}

describe('Sprite2D without a texture', () => {
  it('draws nothing when no texture is authored', async () => {
    const renderer = await render(spriteNode({}));

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws nothing for a null texture', async () => {
    const renderer = await render(spriteNode({ texture: 'null' }));

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws the missing-resource placeholder for a texture that cannot be loaded', async () => {
    const renderer = await render(spriteNode({ texture: 'ExtResource("1")' }));

    expect(placeholders(renderer)).toHaveLength(1);
  });
});
