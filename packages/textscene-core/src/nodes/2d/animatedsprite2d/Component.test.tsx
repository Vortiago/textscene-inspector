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

describe('AnimatedSprite2D playback', () => {
  // Two-frame "right" animation at 5 fps (0.2s/frame), looping.
  const FRAMES_2 =
    '[{"frames": [{"duration": 1.0, "texture": ExtResource("2")}, {"duration": 1.0, "texture": ExtResource("3")}], "loop": true, "name": &"right", "speed": 5.0}]';

  // Distinct widths per frame so the displayed frame is identifiable.
  async function renderPlaying(frame = '0') {
    const fake = createFakeResourceLoader();
    const tex0 = new THREE.Texture();
    (tex0 as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
    const tex1 = new THREE.Texture();
    (tex1 as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 16 };
    fake.textures.seed('res://f0.png', tex0);
    fake.textures.seed('res://f1.png', tex1);
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'SubResource("sf")',
        animation: '&"right"',
        frame,
      }),
    };
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[{ id: 'sf', type: 'SpriteFrames', data: { animations: FRAMES_2, id: 'sf' } }]}
          externalResources={[
            { id: '2', type: 'Texture2D', path: 'res://f0.png' },
            { id: '3', type: 'Texture2D', path: 'res://f1.png' },
          ]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  function frameWidth(r: Awaited<ReturnType<typeof renderPlaying>>): number {
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    return (mesh.geometry as THREE.PlaneGeometry).parameters.width;
  }

  // Advance one canvas tick, then drain the trailing useResource effect +
  // its re-render (frame change → new path → cache read → setResult).
  async function tick(r: Awaited<ReturnType<typeof renderPlaying>>, delta: number) {
    await r.advanceFrames(1, delta);
    await ReactThreeTestRenderer.act(async () => {});
  }

  it('starts on the authored frame before the canvas ticks', async () => {
    const r = await renderPlaying('0');
    expect(frameWidth(r)).toBe(32); // frame 0
  });

  it('advances to the next frame as canvas time elapses', async () => {
    const r = await renderPlaying('0');
    await tick(r, 0.3); // past the 0.2s frame-0 window
    expect(frameWidth(r)).toBe(64); // frame 1
  });

  it('loops back to the first frame after the final frame', async () => {
    const r = await renderPlaying('0');
    await tick(r, 0.3); // elapsed 0.3 → frame 1
    expect(frameWidth(r)).toBe(64);
    await tick(r, 0.15); // elapsed 0.45 → 0.45 % 0.4 = 0.05 → wrapped to frame 0
    expect(frameWidth(r)).toBe(32);
  });
});

describe('AnimatedSprite2D authored-frame reactivity', () => {
  // speed 0 → not playing, so the displayed frame is the authored `props.frame`
  // and must stay reactive to live .tscn edits (the fiber is reused across an
  // edit because NodeDispatcher keys nodes by node.name).
  const STATIC_2 =
    '[{"frames": [{"duration": 1.0, "texture": ExtResource("2")}, {"duration": 1.0, "texture": ExtResource("3")}], "loop": true, "name": &"pose", "speed": 0.0}]';

  function makeFake() {
    const fake = createFakeResourceLoader();
    const tex0 = new THREE.Texture();
    (tex0 as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
    const tex1 = new THREE.Texture();
    (tex1 as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 16 };
    fake.textures.seed('res://f0.png', tex0);
    fake.textures.seed('res://f1.png', tex1);
    return fake;
  }

  function tree(fake: ReturnType<typeof createFakeResourceLoader>, frame: string) {
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'SubResource("sf")',
        animation: '&"pose"',
        frame,
      }),
    };
    return (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[{ id: 'sf', type: 'SpriteFrames', data: { animations: STATIC_2, id: 'sf' } }]}
          externalResources={[
            { id: '2', type: 'Texture2D', path: 'res://f0.png' },
            { id: '3', type: 'Texture2D', path: 'res://f1.png' },
          ]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('reflects a changed authored frame on a reused fiber when not playing', async () => {
    const fake = makeFake();
    const r = await ReactThreeTestRenderer.create(tree(fake, '0'));
    const width = () => ((r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.PlaneGeometry).parameters.width;
    expect(width()).toBe(32); // authored frame 0

    await ReactThreeTestRenderer.act(async () => {
      await r.update(tree(fake, '1')); // edit frame 0 → 1 on the same fiber
    });
    await ReactThreeTestRenderer.act(async () => {}); // settle the texture swap
    expect(width()).toBe(64); // frame 1 — reactive, not frozen at 0
  });
});
