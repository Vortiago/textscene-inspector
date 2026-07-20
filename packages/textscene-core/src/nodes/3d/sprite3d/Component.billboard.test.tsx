/**
 * Sprite3D `billboard` actually turns the sprite.
 *
 * The mode was stashed in `mesh.userData.billboardMode` with no reader anywhere
 * in the codebase, so a billboarded sprite never faced the camera — while the
 * sibling Label3D slice implemented the same property properly. Two vendored
 * scenes pair the two node types side by side to demonstrate the modes
 * (scenes/demos/3d/sprites/3d_sprites.tscn `Testers/Billboard`), so the label
 * turned and the sprite beside it did not.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Sprite3D } from './Component';
import { parseSprite3D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { name: 'Sprite', type: 'Sprite3D' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Sprite', type: 'Sprite3D', children: [], properties: parseSprite3D(heading, raw) };
}

/**
 * Render with a declared-but-unloaded texture — the branch that keeps the
 * node's own transform group mounted — advance a frame, and report the object
 * billboarding was applied to.
 */
const EXTERNALS = [{ id: '1_tex', path: 'res://sprite.png', type: 'Texture2D' }] as const;

async function objectAfterFrame(raw: Record<string, string>) {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={[...EXTERNALS]}>
        <Sprite3D node={node({ texture: 'ExtResource("1_tex")', ...raw })} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await renderer.advanceFrames(2, 16);
  return renderer.scene.children[0]!.instance as THREE.Object3D;
}

describe('<Sprite3D> billboard', () => {
  it('leaves the sprite alone when billboard is DISABLED (the default)', async () => {
    const object = await objectAfterFrame({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)' });
    expect(object.quaternion.x).toBeCloseTo(0, 6);
    expect(object.quaternion.y).toBeCloseTo(0, 6);
    expect(object.quaternion.z).toBeCloseTo(0, 6);
  });

  it('overrides the authored rotation with the camera basis when ENABLED', async () => {
    // A quarter turn about Y, which billboarding must throw away: Godot's
    // ENABLED replaces the model basis with the camera's, so the sprite ends up
    // carrying the camera's orientation whatever the scene authored.
    const yawed = 'Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 3, 0, 0)';
    const authored = await objectAfterFrame({ transform: yawed });
    expect(Math.abs(authored.quaternion.y)).toBeGreaterThan(0.5);

    const billboarded = await objectAfterFrame({ billboard: '1', transform: yawed });
    expect(billboarded.quaternion.x).toBeCloseTo(0, 6);
    expect(billboarded.quaternion.y).toBeCloseTo(0, 6);
    expect(billboarded.quaternion.z).toBeCloseTo(0, 6);
  });

  it('turns only around Y when billboard is FIXED_Y', async () => {
    const object = await objectAfterFrame({
      billboard: '2',
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 2, 0)',
    });
    expect(object.rotation.x).toBeCloseTo(0, 6);
    expect(object.rotation.z).toBeCloseTo(0, 6);
    expect(Math.abs(object.rotation.y)).toBeGreaterThan(0);
  });
});
