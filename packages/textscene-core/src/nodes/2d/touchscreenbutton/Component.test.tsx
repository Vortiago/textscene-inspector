/** Tests that TouchScreenButton draws `texture_normal` with its top-left corner at the node origin. */
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTouchScreenButton } from './parser';
import { TouchScreenButton } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';

const TEXTURE_PATH = 'res://button.png';
const buttonHeading = heading('TouchScreenButton', { name: 'Jump' });
const circleShape: TscnInternalResource = {
  id: 'CircleShape2D_1',
  type: 'CircleShape2D',
  data: { radius: '15' },
};

function buttonNode(raw: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Jump',
    type: 'TouchScreenButton',
    children: [],
    properties: parseTouchScreenButton(buttonHeading, raw),
  };
}

function scene(node: TscnNode, { showCollisions = false, children = null as ReactElement | null } = {}) {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 32 };
  fake.textures.seed(TEXTURE_PATH, texture);
  return (
    <ResourceLoaderProvider loader={fake.loader}>
      <ViewportModeProvider initialShowCollisions={showCollisions}>
        <SceneResourcesProvider
          internalResources={[circleShape]}
          externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
        >
          <TouchScreenButton node={node}>{children}</TouchScreenButton>
        </SceneResourcesProvider>
      </ViewportModeProvider>
    </ResourceLoaderProvider>
  );
}

function render(node: TscnNode, options?: Parameters<typeof scene>[1]) {
  return ReactThreeTestRenderer.create(scene(node, options));
}

const TEXTURED = { texture_normal: 'ExtResource("1")' };
const SHAPED = { ...TEXTURED, shape: 'SubResource("CircleShape2D_1")' };

function shapeLines(r: Awaited<ReturnType<typeof render>>) {
  return r.scene.findAll((n) => n.type === 'LineSegments');
}

/** Where the outline sits relative to the button node, in three's +Y-up space. */
function outlineCentre(r: Awaited<ReturnType<typeof render>>): [number, number] {
  const outline = shapeLines(r)[0]!.instance;
  outline.updateWorldMatrix(true, false);
  const centre = outline.getWorldPosition(new THREE.Vector3());
  return [centre.x, centre.y];
}

describe('TouchScreenButton texture', () => {
  it('puts the texture top-left at the node origin, whatever the Sprite2D default centres', async () => {
    const r = await render(buttonNode(TEXTURED));
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;

    // 64 x 32 px texture, +Y down in Godot, so the centre sits at (32, -16).
    expect(mesh.position.x).toBeCloseTo(32, 5);
    expect(mesh.position.y).toBeCloseTo(-16, 5);
  });

  it('sizes the quad to the texture in pixels', async () => {
    const r = await render(buttonNode(TEXTURED));
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const { width, height } = (mesh.geometry as THREE.PlaneGeometry).parameters;

    expect([width, height]).toEqual([64, 32]);
  });

  it('draws nothing without a texture_normal', async () => {
    const r = await render(buttonNode({}));

    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws nothing for a null texture_normal', async () => {
    const r = await render(buttonNode({ texture_normal: 'null' }));

    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('tints the texture with modulate, as a Sprite2D does', async () => {
    const r = await render(buttonNode({ ...TEXTURED, modulate: 'Color(0, 0, 0, 1)' }));
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;

    expect((mesh.material as THREE.MeshBasicMaterial).color.r).toBeCloseTo(0, 5);
  });

  it('keeps its children mounted when texture_normal is removed', async () => {
    const probe = <group name="Probe" />;
    const r = await render(buttonNode(TEXTURED), { children: probe });
    const before = r.scene.findByProps({ name: 'Probe' }).instance;

    await r.update(scene(buttonNode({}), { children: probe }));

    expect(r.scene.findByProps({ name: 'Probe' }).instance).toBe(before);
  });
});

describe('TouchScreenButton collision shape overlay', () => {
  it('draws no outline while Visible Collision Shapes is off', async () => {
    const r = await render(buttonNode(SHAPED));

    expect(shapeLines(r)).toHaveLength(0);
  });

  it('draws the outline on the texture centre when Visible Collision Shapes is on', async () => {
    const r = await render(buttonNode(SHAPED), { showCollisions: true });
    await ReactThreeTestRenderer.act(async () => {});

    expect(shapeLines(r)).toHaveLength(1);
    expect(outlineCentre(r)).toEqual([32, -16]);
  });

  it('draws the outline on the node origin when shape_centered is false', async () => {
    const r = await render(buttonNode({ ...SHAPED, shape_centered: 'false' }), { showCollisions: true });

    expect(outlineCentre(r)).toEqual([0, 0]);
  });

  it('draws the outline on the node origin when there is no texture_normal', async () => {
    const r = await render(buttonNode({ shape: 'SubResource("CircleShape2D_1")' }), {
      showCollisions: true,
    });

    expect(outlineCentre(r)).toEqual([0, 0]);
  });

  it('draws no outline when shape_visible is false', async () => {
    const r = await render(buttonNode({ ...SHAPED, shape_visible: 'false' }), { showCollisions: true });

    expect(shapeLines(r)).toHaveLength(0);
  });

  it('draws no outline without a shape', async () => {
    const r = await render(buttonNode(TEXTURED), { showCollisions: true });

    expect(shapeLines(r)).toHaveLength(0);
  });
});
