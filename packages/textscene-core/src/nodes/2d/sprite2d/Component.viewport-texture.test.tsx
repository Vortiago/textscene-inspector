/**
 * A Sprite2D whose `texture` is a ViewportTexture samples the target's plain view, as any canvas
 * item samples a texture: it filters the stored bytes and multiplies them by its modulate in sRGB
 * (`renderer_canvas_render_rd.cpp:3318-3323`, `texture_storage.cpp:754`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { parseSprite2D } from './parser';
import { Sprite2D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { ViewportTexturePublisher, viewportEntry } from '../../../r3f/testing/ViewportTexturePublisher';
import { createCanvasTarget, createSceneTarget } from '../../viewport/subviewport/offscreenViewport';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { copiesFilledFrom } from '../../../r3f/liveTargets.testkit';

const VIEWPORT_TEXTURE_RESOURCE: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { viewport_path: 'NodePath("SubViewport")' },
};

function spriteNode(): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Sprite2D', name: 'ViewportSprite' } };
  return {
    rawProperties: {},
    name: 'ViewportSprite',
    type: 'Sprite2D',
    children: [],
    properties: parseSprite2D(heading, { texture: 'SubResource("ViewportTexture_1")' }),
  };
}

/** The material of the sprite's quad, which samples its own copy of `published` from `Root/SubViewport`. */
async function spriteMaterial(published: THREE.Texture): Promise<THREE.MeshBasicMaterial> {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[VIEWPORT_TEXTURE_RESOURCE]} externalResources={[]}>
        <ViewportTextureProvider>
          <ViewportTexturePublisher
            path="Root/SubViewport"
            entry={viewportEntry(published, { x: 16, y: 16 })}
          />
          <NodePathProvider path="Root/ViewportSprite">
            <Sprite2D node={spriteNode()} />
          </NodePathProvider>
        </ViewportTextureProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const material = renderer.scene
    .findAll(() => true)
    .map((n) => (n.instance as THREE.Mesh).material)
    .filter((m): m is THREE.MeshBasicMaterial => !!m && !Array.isArray(m))
    .find((m) => m.map !== null && copiesFilledFrom(published).includes(m.map));
  return material!;
}

describe('<Sprite2D> with a ViewportTexture', () => {
  it('multiplies a canvas target in sRGB', async () => {
    const target = createCanvasTarget(16, 16, 'SubViewport');
    expect((await spriteMaterial(target.texture)).defines).toEqual({ CANVAS_SRGB_MULTIPLY: '' });
    target.dispose();
  });

  it('keeps the linear multiply for a 3D-content target (edge case)', async () => {
    const target = createSceneTarget(16, 16, 'SubViewport');
    expect((await spriteMaterial(target.texture)).defines?.CANVAS_SRGB_MULTIPLY).toBeUndefined();
    target.dispose();
  });
});
