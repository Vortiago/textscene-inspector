/**
 * A Sprite2D with no texture draws nothing, as Godot's draw returns early (`sprite_2d.cpp:159`).
 * A texture that fails to load draws nothing too: Godot's loader leaves the property null.
 */
import { describe, expect, it } from 'vitest';
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

describe('Sprite2D without a texture', () => {
  it('draws nothing when no texture is authored', async () => {
    const renderer = await render(spriteNode({}));

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws nothing for a null texture', async () => {
    const renderer = await render(spriteNode({ texture: 'null' }));

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws nothing for a texture that cannot be loaded', async () => {
    const renderer = await render(spriteNode({ texture: 'ExtResource("1")' }));

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
