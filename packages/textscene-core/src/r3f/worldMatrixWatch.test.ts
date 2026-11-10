import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { markCanvasFrame } from './canvasFrame';
import { WorldMatrixWatch, withCanvasFrames } from './worldMatrixWatch';

function objectAt(x: number): THREE.Object3D {
  const object = new THREE.Object3D();
  object.position.x = x;
  object.updateMatrixWorld();
  return object;
}

describe('WorldMatrixWatch', () => {
  it('reports the first call as moved and an unchanged second call as still', () => {
    const watch = new WorldMatrixWatch();
    const objects = [objectAt(1)];
    expect(watch.hasMoved(objects)).toBe(true);
    expect(watch.hasMoved(objects)).toBe(false);
  });

  it('reports a moved origin once', () => {
    const watch = new WorldMatrixWatch();
    const object = objectAt(1);
    watch.hasMoved([object]);
    object.position.x = 5;
    object.updateMatrixWorld();
    expect(watch.hasMoved([object])).toBe(true);
    expect(watch.hasMoved([object])).toBe(false);
  });

  it('reports a change of the object count as moved', () => {
    const watch = new WorldMatrixWatch();
    const object = objectAt(1);
    watch.hasMoved([object]);
    expect(watch.hasMoved([object, object])).toBe(true);
  });

  it('reads a null object as zeros, so its arrival counts as moved', () => {
    const watch = new WorldMatrixWatch();
    watch.hasMoved([null]);
    expect(watch.hasMoved([null])).toBe(false);
    expect(watch.hasMoved([objectAt(1)])).toBe(true);
  });

  it('reports the first call on no objects as moved', () => {
    expect(new WorldMatrixWatch().hasMoved([])).toBe(true);
  });

  it('reports the next call as moved after forget', () => {
    const watch = new WorldMatrixWatch();
    const objects = [objectAt(1)];
    watch.hasMoved(objects);
    watch.forget();
    expect(watch.hasMoved(objects)).toBe(true);
  });
});

describe('withCanvasFrames', () => {
  it('appends each canvas frame once, and none for an object outside a canvas', () => {
    const frame = new THREE.Group();
    markCanvasFrame(frame);
    const first = new THREE.Object3D();
    const second = new THREE.Object3D();
    frame.add(first, second);
    const bare = new THREE.Object3D();
    expect(withCanvasFrames([first, second, bare, null])).toEqual([first, second, bare, null, frame]);
  });
});
