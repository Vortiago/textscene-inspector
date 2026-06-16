/**
 * AnimatedSprite2D render behavior: resolves the current animation frame from
 * the SpriteFrames SubResource and draws it as a modulated quad; missing
 * sprite_frames falls back to the placeholder. Pinned before the CanvasItem2D
 * migration so the refactor runs under green.
 */
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseAnimatedSprite2D } from './parser';
import { AnimatedSprite2D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'AnimatedSprite2D', name: 'A' } };
const TEX = 'res://frame3.png';

const ANIMATIONS =
  '[{"frames": [{"duration": 1.0, "texture": ExtResource("2")}, {"duration": 1.0, "texture": ExtResource("3")}], "loop": true, "name": &"right", "speed": 5.0}]';

function makeNode(raw: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  return {
    name: 'A',
    type: 'AnimatedSprite2D',
    children,
    properties: parseAnimatedSprite2D(heading, raw),
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

async function render(rootNode: TscnNode) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
  fake.textures.seed(TEX, tex);
  const renderNode = (n: TscnNode): ReactElement => (
    <AnimatedSprite2D node={n}>
      {n.children.map((c, i) => (
        <AnimatedSprite2D key={i} node={c} />
      ))}
    </AnimatedSprite2D>
  );
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[{ id: 'sf', type: 'SpriteFrames', data: { animations: ANIMATIONS, id: 'sf' } }]}
        externalResources={[{ id: '3', type: 'Texture2D', path: TEX }]}
      >
        {renderNode(rootNode)}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('AnimatedSprite2D render', () => {
  it('draws the current frame texture as a quad with the modulate tint applied', async () => {
    const r = await render(
      makeNode({
        sprite_frames: 'SubResource("sf")',
        animation: '&"right"',
        frame: '1',
        modulate: 'Color(0.5, 0.5, 0.5, 1)',
      })
    );
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.map).toBeTruthy();
    expect((mesh.geometry as THREE.PlaneGeometry).parameters.width).toBe(32);
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.5), 4);
  });

  it('renders the magenta placeholder when sprite_frames is missing', async () => {
    const r = await render(makeNode({}));
    const material = r.scene.findByType('Mesh').instance.material as THREE.MeshBasicMaterial;
    expect(material.color.getHexString()).toBe('ff00ff');
  });
});
