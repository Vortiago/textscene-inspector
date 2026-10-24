import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EMPTY_AABB } from '../../godot/math/aabb';
import type { LightmapUser } from '../../resources/lightmapgidata/types';
import { fireSceneRender } from '../testing/fireSceneRender';
import { assignedUsers, LightmapInstance, lightmapExposureScale, lightmapsOf } from './sceneLightmaps';

function user(path: string, subInstance = -1): LightmapUser {
  return { path, uvScale: { x: 0, y: 0, width: 1, height: 1 }, sliceIndex: 0, subInstance };
}

/** A LightmapGI at the origin with a loaded atlas and a 2 m box around it. */
function drawableInstance(order: number[] = [0]): LightmapInstance {
  const instance = new LightmapInstance(new THREE.Object3D());
  instance.order = order;
  instance.atlas = new THREE.DataArrayTexture();
  instance.bounds = { position: { x: -1, y: -1, z: -1 }, size: { x: 2, y: 2, z: 2 } };
  return instance;
}

function sceneWith(...instances: LightmapInstance[]) {
  const scene = new THREE.Scene();
  const lightmaps = lightmapsOf(scene);
  for (const instance of instances) {
    scene.add(instance.object);
    lightmaps.add(instance);
  }
  return { scene, lightmaps };
}

/** Renders `scene` through a camera on +Z that looks at the origin, or away from it. */
function renderLookingAt(scene: THREE.Scene, target: THREE.Vector3) {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  fireSceneRender(scene, camera);
}

describe('assignedUsers', () => {
  it('keys each user by the node path it names from the LightmapGI', () => {
    const users = assignedUsers('Root/Lightmap', [user('../Floor')], undefined);
    expect([...users.keys()]).toEqual(['Root/Floor']);
  });

  it("keeps a user that means one of a node's baked meshes apart from a user of the node itself", () => {
    const users = assignedUsers('Root/Lightmap', [user('../Grid'), user('../Grid', 1)], undefined);
    expect(users.size).toBe(2);
  });

  it('keeps the later of two users of one node, as each assignment replaces the last', () => {
    const later = { ...user('../Floor'), sliceIndex: 3 };
    expect(assignedUsers('Root/Lightmap', [user('../Floor'), later], undefined).get('Root/Floor')).toBe(
      later
    );
  });

  it('assigns no user whose path walks above the scene root (edge case)', () => {
    expect(assignedUsers('Root/Lightmap', [user('../../Outside')], undefined).size).toBe(0);
  });
});

describe('SceneLightmaps.assignmentFor', () => {
  it('assigns a node the LightmapGI that names it', () => {
    const instance = drawableInstance();
    instance.users = assignedUsers('Root/Lightmap', [user('../Floor')], undefined);
    const { lightmaps } = sceneWith(instance);
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap).toBe(instance);
  });

  it('gives a node two LightmapGIs name the one that assigns last, an ancestor after its descendants', () => {
    const ancestor = drawableInstance([0]);
    ancestor.users = new Map([['Root/Floor', user('Floor')]]);
    const descendant = drawableInstance([0, 1]);
    descendant.users = new Map([['Root/Floor', user('../Floor')]]);
    const { lightmaps } = sceneWith(ancestor, descendant);
    expect(lightmaps.assignmentFor('Root/Floor')?.lightmap).toBe(ancestor);
  });

  it("assigns a GridMap's baked mesh the user that names its index", () => {
    const instance = drawableInstance();
    const second = user('../Grid', 1);
    instance.users = assignedUsers('Root/Lightmap', [user('../Grid', 0), second], undefined);
    const { lightmaps } = sceneWith(instance);
    expect(lightmaps.assignmentFor('Root/Grid', 1)?.user).toBe(second);
  });

  it('assigns a node itself no user that names one of its baked meshes (edge case)', () => {
    const instance = drawableInstance();
    instance.users = assignedUsers('Root/Lightmap', [user('../Grid', 0)], undefined);
    const { lightmaps } = sceneWith(instance);
    expect(lightmaps.assignmentFor('Root/Grid')).toBeNull();
  });

  it('assigns no LightmapGI to a node none names (edge case)', () => {
    const { lightmaps } = sceneWith(drawableInstance());
    expect(lightmaps.assignmentFor('Root/Wall')).toBeNull();
  });

  it('answers the same assignment until the LightmapGIs change', () => {
    const instance = drawableInstance();
    instance.users = new Map([['Root/Floor', user('../Floor')]]);
    const { lightmaps } = sceneWith(instance);
    expect(lightmaps.assignmentFor('Root/Floor')).toBe(lightmaps.assignmentFor('Root/Floor'));
  });

  it('drops the assignment of a LightmapGI that leaves', () => {
    const instance = drawableInstance();
    instance.users = new Map([['Root/Floor', user('../Floor')]]);
    const scene = new THREE.Scene();
    const lightmaps = lightmapsOf(scene);
    const remove = lightmaps.add(instance);
    remove();
    expect(lightmaps.assignmentFor('Root/Floor')).toBeNull();
  });
});

describe('SceneLightmaps.subscribe', () => {
  it('tells a listener when a LightmapGI arrives, changes and leaves', () => {
    const scene = new THREE.Scene();
    const lightmaps = lightmapsOf(scene);
    const listener = vi.fn();
    lightmaps.subscribe(listener);
    const instance = drawableInstance();
    const remove = lightmaps.add(instance);
    lightmaps.changed();
    remove();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('stops telling a listener once it unsubscribes (edge case)', () => {
    const lightmaps = lightmapsOf(new THREE.Scene());
    const listener = vi.fn();
    lightmaps.subscribe(listener)();
    lightmaps.changed();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('LightmapInstance.isDrawn', () => {
  it('draws a loaded lightmap whose bounds the camera sees', () => {
    const instance = drawableInstance();
    const { scene } = sceneWith(instance);
    renderLookingAt(scene, new THREE.Vector3(0, 0, 0));
    expect(instance.isDrawn).toBe(true);
  });

  it('draws no lightmap whose bounds lie outside the frustum, as the cull leaves it out', () => {
    const instance = drawableInstance();
    const { scene } = sceneWith(instance);
    renderLookingAt(scene, new THREE.Vector3(0, 0, 20));
    expect(instance.isDrawn).toBe(false);
  });

  it('places the bounds at the LightmapGI node', () => {
    const instance = drawableInstance();
    instance.object.position.set(0, 0, 20);
    const { scene } = sceneWith(instance);
    renderLookingAt(scene, new THREE.Vector3(0, 0, 20));
    expect(instance.isDrawn).toBe(true);
  });

  it('draws no lightmap under a hidden ancestor', () => {
    const instance = drawableInstance();
    const { scene } = sceneWith(instance);
    const parent = new THREE.Group();
    parent.visible = false;
    parent.add(instance.object);
    scene.add(parent);
    renderLookingAt(scene, new THREE.Vector3(0, 0, 0));
    expect(instance.isDrawn).toBe(false);
  });

  it('draws no lightmap before its atlas loads', () => {
    const instance = drawableInstance();
    instance.atlas = null;
    const { scene } = sceneWith(instance);
    renderLookingAt(scene, new THREE.Vector3(0, 0, 0));
    expect(instance.isDrawn).toBe(false);
  });

  it('draws no lightmap whose bounds have no surface, which the cull never indexes (edge case)', () => {
    const instance = drawableInstance();
    instance.bounds = EMPTY_AABB;
    const { scene } = sceneWith(instance);
    renderLookingAt(scene, new THREE.Vector3(0, 0, 0));
    expect(instance.isDrawn).toBe(false);
  });
});

describe('lightmapExposureScale', () => {
  it('divides the world exposure by the exposure the bake ran at', () => {
    expect(lightmapExposureScale(2, 4)).toBe(0.5);
  });

  it('is 1 without camera attributes, whatever the bake ran at', () => {
    expect(lightmapExposureScale(null, 4)).toBe(1);
  });

  it('is 0 under an exposure of 0 (edge case)', () => {
    expect(lightmapExposureScale(0, 1)).toBe(0);
  });
});
