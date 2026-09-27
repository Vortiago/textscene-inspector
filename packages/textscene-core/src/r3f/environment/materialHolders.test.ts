/**
 * The material-holder list a per-frame pass reads instead of a scene walk: the root is walked once,
 * each change three reports walks only the subtree it names, and the list stays complete after
 * every kind of change three reports.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MaterialHolders } from './materialHolders';

function mesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
}

/** The list as a set: a removal swaps the last holder into the gap, so order is not kept. */
function holderSet(holders: MaterialHolders): Set<THREE.Object3D> {
  return new Set(holders.current());
}

describe('MaterialHolders', () => {
  it('lists every object under the root that carries a material, and nothing else', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const inner = mesh();
    const outer = mesh();
    const sprite = new THREE.Sprite();
    group.add(inner);
    scene.add(group, outer, sprite, new THREE.PointLight());

    expect(holderSet(new MaterialHolders(scene))).toEqual(new Set([inner, outer, sprite]));
  });

  it('walks the root once while nothing is added or removed', () => {
    const scene = new THREE.Scene();
    scene.add(mesh());
    const traverse = vi.spyOn(scene, 'traverse');
    const holders = new MaterialHolders(scene);

    const first = holders.current();
    for (let frame = 0; frame < 10; frame += 1) expect(holders.current()).toBe(first);
    expect(traverse).toHaveBeenCalledTimes(1);
  });

  it('keeps an unchanged list after a material swap, which moves no object', () => {
    const scene = new THREE.Scene();
    const holder = mesh();
    scene.add(holder);
    const traverse = vi.spyOn(scene, 'traverse');
    const holders = new MaterialHolders(scene);
    holders.current();

    holder.material = new THREE.MeshPhysicalMaterial();
    expect(holders.current()).toEqual([holder]);
    expect(traverse).toHaveBeenCalledTimes(1);
  });

  it('picks up a mesh added anywhere below the root, including under a later-added group', () => {
    const scene = new THREE.Scene();
    const holders = new MaterialHolders(scene);
    expect(holders.current()).toEqual([]);

    const group = new THREE.Group();
    scene.add(group);
    expect(holders.current()).toEqual([]);

    const late = mesh();
    group.add(late);
    expect(holders.current()).toEqual([late]);
  });

  it('walks only the added subtree, never the root again, when a mesh arrives', () => {
    const scene = new THREE.Scene();
    scene.add(mesh(), mesh());
    const holders = new MaterialHolders(scene);
    holders.current();
    const rootWalk = vi.spyOn(scene, 'traverse');

    const late = mesh();
    const subtreeWalk = vi.spyOn(late, 'traverse');
    scene.add(late);
    expect(holders.current()).toContain(late);
    expect(subtreeWalk).toHaveBeenCalledTimes(1);
    expect(rootWalk).not.toHaveBeenCalled();
  });

  it('picks up a subtree that arrives whole, as a GLB clone does', () => {
    const scene = new THREE.Scene();
    const holders = new MaterialHolders(scene);
    holders.current();

    const clone = new THREE.Group();
    const deep = mesh();
    clone.add(new THREE.Group().add(deep));
    scene.add(clone);
    expect(holders.current()).toEqual([deep]);
  });

  it('picks up an object attached with its world transform kept', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const holders = new MaterialHolders(scene);
    holders.current();

    const attached = mesh();
    group.attach(attached);
    expect(holders.current()).toEqual([attached]);
  });

  it('keeps a holder that moves between two parents under the root, once', () => {
    const scene = new THREE.Scene();
    const from = new THREE.Group();
    const to = new THREE.Group();
    const moving = mesh();
    from.add(moving);
    scene.add(from, to);
    const holders = new MaterialHolders(scene);
    holders.current();

    to.add(moving);
    expect(holders.current()).toEqual([moving]);
  });

  it('drops a removed mesh, and stops listening to the subtree it took along', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const leaving = mesh();
    group.add(leaving);
    scene.add(group);
    const holders = new MaterialHolders(scene);
    const listeners = listenersAddedTo(group, () => holders.current());
    expect(holders.current()).toEqual([leaving]);

    scene.remove(group);
    expect(holders.current()).toEqual([]);
    for (const [type, listener] of listeners) {
      expect(group.hasEventListener(type, listener)).toBe(false);
    }
  });

  it('keeps every other holder when one is removed from the middle of the list', () => {
    const scene = new THREE.Scene();
    const [first, middle, last] = [mesh(), mesh(), mesh()];
    scene.add(first, middle, last);
    const holders = new MaterialHolders(scene);
    holders.current();

    scene.remove(middle);
    expect(holderSet(holders)).toEqual(new Set([first, last]));
    scene.remove(last);
    expect(holders.current()).toEqual([first]);
  });

  it('ignores changes to a subtree once it has left the root', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const holders = new MaterialHolders(scene);
    holders.current();
    scene.remove(group);

    group.add(mesh());
    expect(holders.current()).toEqual([]);
  });

  it('removes every listener on dispose, and walks afresh when read again', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const holders = new MaterialHolders(scene);
    const listeners = listenersAddedTo(scene, () => holders.current());

    holders.dispose();
    for (const [type, listener] of listeners) {
      expect(scene.hasEventListener(type, listener)).toBe(false);
      expect(group.hasEventListener(type, listener)).toBe(false);
    }

    const late = mesh();
    group.add(late);
    expect(holders.current()).toEqual([late]);
  });
});

type ListenerArgs = Parameters<THREE.Object3D['addEventListener']>;

/** Every listener `act` adds to `object`, with its event type, captured while `act` runs. */
function listenersAddedTo(object: THREE.Object3D, act: () => void): [ListenerArgs[0], ListenerArgs[1]][] {
  const addEventListener = vi.spyOn(object, 'addEventListener');
  act();
  const added = addEventListener.mock.calls.map(([type, listener]) => [type, listener] as [ListenerArgs[0], ListenerArgs[1]]);
  addEventListener.mockRestore();
  if (added.length === 0) throw new Error('expected the tracker to listen on the object');
  return added;
}
