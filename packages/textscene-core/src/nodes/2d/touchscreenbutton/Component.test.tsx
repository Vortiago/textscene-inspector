/** Tests that TouchScreenButton draws `texture_normal` with its top-left corner at the node origin. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTouchScreenButton } from './parser';
import { TouchScreenButton } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';

const TEXTURE_PATH = 'res://button.png';
const buttonHeading = heading('TouchScreenButton', { name: 'Jump' });

function buttonNode(raw: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Jump',
    type: 'TouchScreenButton',
    children: [],
    properties: parseTouchScreenButton(buttonHeading, raw),
  };
}

function render(node: TscnNode) {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 32 };
  fake.textures.seed(TEXTURE_PATH, texture);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
      >
        <TouchScreenButton node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('TouchScreenButton', () => {
  it('puts the texture top-left at the node origin, whatever the Sprite2D default centres', async () => {
    const r = await render(buttonNode({ texture_normal: 'ExtResource("1")' }));
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;

    // 64 x 32 px texture, +Y down in Godot, so the centre sits at (32, -16).
    expect(mesh.position.x).toBeCloseTo(32, 5);
    expect(mesh.position.y).toBeCloseTo(-16, 5);
    expect((mesh.geometry as THREE.PlaneGeometry).parameters.width).toBeCloseTo(64, 5);
    expect((mesh.geometry as THREE.PlaneGeometry).parameters.height).toBeCloseTo(32, 5);
  });

  it('draws nothing without a texture_normal', async () => {
    const r = await render(buttonNode({}));

    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('tints the texture with modulate, as a Sprite2D does', async () => {
    const r = await render(buttonNode({ texture_normal: 'ExtResource("1")', modulate: 'Color(0, 0, 0, 1)' }));
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;

    expect((mesh.material as THREE.MeshBasicMaterial).color.r).toBeCloseTo(0, 5);
  });
});
