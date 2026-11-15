import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { markCanvasFrame } from './canvasFrame';
import { WorldMatrixWatch } from './worldMatrixWatch';

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

describe('WorldMatrixWatch canvas frames', () => {
  function framedObject(): { frame: THREE.Group; object: THREE.Object3D } {
    const frame = new THREE.Group();
    markCanvasFrame(frame);
    const object = new THREE.Object3D();
    frame.add(object);
    frame.updateMatrixWorld(true);
    return { frame, object };
  }

  it('reports a moved frame as a move of the object under it', () => {
    const watch = new WorldMatrixWatch();
    const { frame, object } = framedObject();
    watch.hasMoved([object]);
    frame.position.x = 40;
    frame.updateMatrixWorld(true);
    expect(watch.hasMoved([object])).toBe(true);
  });

  it('reports an object moved under another frame, with the same object list', () => {
    const watch = new WorldMatrixWatch();
    const { object } = framedObject();
    watch.hasMoved([object]);
    const other = new THREE.Group();
    markCanvasFrame(other);
    other.position.x = 25;
    other.add(object);
    other.updateMatrixWorld(true);
    expect(watch.hasMoved([object])).toBe(true);
  });

  it('reports an object moved out of its frame onto the root canvas', () => {
    const watch = new WorldMatrixWatch();
    const { frame, object } = framedObject();
    frame.position.x = 40;
    frame.updateMatrixWorld(true);
    watch.hasMoved([object]);
    frame.remove(object);
    object.updateMatrixWorld(true);
    expect(watch.hasMoved([object])).toBe(true);
  });
});
