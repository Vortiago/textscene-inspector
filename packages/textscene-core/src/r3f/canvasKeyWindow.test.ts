import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OVER_EVERY_LAYER, canvasKeyOf, drawKeyedObjects, type KeyedObjects } from './canvasKeyWindow';

function keyedOf(scene: THREE.Object3D): KeyedObjects {
  const objects: THREE.Object3D[] = [];
  const keys: number[] = [];
  const ends: number[] = [];
  const minKeys: number[] = [];
  const maxKeys: number[] = [];
  const visit = (object: THREE.Object3D, inherited: number) => {
    const key = canvasKeyOf(object, inherited);
    const index = objects.length;
    objects.push(object);
    keys.push(key);
    ends.push(index + 1);
    minKeys.push(key);
    maxKeys.push(key);
    for (const child of object.children) visit(child, key);
    ends[index] = objects.length;
    for (let i = index + 1; i < ends[index]!; i = ends[i]!) {
      minKeys[index] = Math.min(minKeys[index]!, minKeys[i]!);
      maxKeys[index] = Math.max(maxKeys[index]!, maxKeys[i]!);
    }
  };
  visit(scene, 0);
  return { objects, keys, ends, minKeys, maxKeys };
}

describe('drawKeyedObjects', () => {
  it('draws a subtree over every layer in a span that ends at infinity', () => {
    const scene = new THREE.Group();
    const overWorld = new THREE.Group();
    overWorld.userData[OVER_EVERY_LAYER] = true;
    scene.add(overWorld);
    let isVisibleWhileDrawing = false;

    drawKeyedObjects(keyedOf(scene), { from: 5, to: Number.POSITIVE_INFINITY, admits: () => true }, () => {
      isVisibleWhileDrawing = overWorld.visible;
    });

    expect(isVisibleWhileDrawing).toBe(true);
  });
});
