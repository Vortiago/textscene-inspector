/**
 * Sprite3D `billboard` turns the sprite to face the camera, as Label3D does for the same property.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseSprite3D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const Sprite3D = registeredComponent('Sprite3D');

const heading = { type: 'node', attributes: { name: 'Sprite', type: 'Sprite3D' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name: 'Sprite',
    type: 'Sprite3D',
    children: [],
    properties: parseSprite3D(heading, raw),
  };
}

/**
 * Render with a declared but unloaded texture (the branch that keeps the node's own transform group
 * mounted), advance a frame, and report the object billboarding was applied to.
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

  // The test renderer's camera keeps the identity rotation, so a billboard's world basis is the
  // identity whatever the sprite authored.
  const yawed = 'Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 3, 2, 0)';

  it('overrides the authored rotation with the camera basis when ENABLED', async () => {
    const authored = await objectAfterFrame({ transform: yawed });
    expect(Math.abs(authored.quaternion.y)).toBeGreaterThan(0.5);

    const billboarded = await objectAfterFrame({ billboard: '1', transform: yawed });
    expectAxis(worldAxis(billboarded, 0), [1, 0, 0]);
    expectAxis(worldAxis(billboarded, 1), [0, 1, 0]);
  });

  it('takes the camera axes about world up when billboard is FIXED_Y', async () => {
    const object = await objectAfterFrame({ billboard: '2', transform: yawed });
    expectAxis(worldAxis(object, 1), [0, 1, 0]);
    expectAxis(worldAxis(object, 2), [0, 0, 1]);
  });

  it('keeps the node origin when it billboards', async () => {
    const object = await objectAfterFrame({ billboard: '1', transform: yawed });
    expectAxis(new THREE.Vector3().setFromMatrixPosition(object.matrixWorld), [3, 2, 0]);
  });
});

function worldAxis(object: THREE.Object3D, column: 0 | 1 | 2): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, column);
}

function expectAxis(actual: THREE.Vector3, expected: [number, number, number]): void {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
}
