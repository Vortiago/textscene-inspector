/** Each Environment part writes its scene only while its Environment is on it. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { drawWithEnvironment, registerEnvironmentPart, ShownEnvironment } from './sceneEnvironment';

/** A part that names the scene after `name` while it is on, and puts the old name back. */
function namePart(scene: THREE.Scene, name: string) {
  return () => {
    const previous = scene.name;
    scene.name = name;
    return () => {
      scene.name = previous;
    };
  };
}

/** A scene that shows `world`, and the call that stops showing it. */
async function showing(world: object) {
  const renderer = await ReactThreeTestRenderer.create(
    <ShownEnvironment environment={world}>{null}</ShownEnvironment>
  );
  return { scene: renderer.scene.instance as THREE.Scene, unmount: () => renderer.unmount() };
}

describe('sceneEnvironment', () => {
  it('puts the part of the shown Environment on the scene', async () => {
    const world = {};
    const { scene } = await showing(world);
    registerEnvironmentPart(scene, world, namePart(scene, 'world'));
    expect(scene.name).toBe('world');
  });

  it('leaves the part of an Environment no one shows off the scene', async () => {
    const { scene } = await showing({});
    registerEnvironmentPart(scene, {}, namePart(scene, 'camera'));
    expect(scene.name).toBe('');
  });

  it('draws with another Environment and puts the shown one back after the draw', async () => {
    const world = {};
    const camera = {};
    const { scene } = await showing(world);
    registerEnvironmentPart(scene, world, namePart(scene, 'world'));
    registerEnvironmentPart(scene, camera, namePart(scene, 'camera'));
    const drawn = drawWithEnvironment(scene, camera, () => scene.name);
    expect([drawn, scene.name]).toEqual(['camera', 'world']);
  });

  it('draws with no Environment at all for null', async () => {
    const world = {};
    const { scene } = await showing(world);
    registerEnvironmentPart(scene, world, namePart(scene, 'world'));
    expect(drawWithEnvironment(scene, null, () => scene.name)).toBe('');
  });

  it('takes a part off when it unregisters', async () => {
    const world = {};
    const { scene } = await showing(world);
    const stop = registerEnvironmentPart(scene, world, namePart(scene, 'world'));
    stop();
    expect(scene.name).toBe('');
  });

  it('takes the parts off when the scene stops showing their Environment', async () => {
    const world = {};
    const { scene, unmount } = await showing(world);
    registerEnvironmentPart(scene, world, namePart(scene, 'world'));
    await unmount();
    expect(scene.name).toBe('');
  });
});
