/**
 * The material-holder list a per-frame pass reads instead of a scene walk: re-collected only after
 * three reports the tree changed, and complete after every kind of change it reports.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MaterialHolders } from './materialHolders';

function mesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
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

    expect(new MaterialHolders(scene).current()).toEqual([inner, outer, sprite]);
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

  it('drops a removed mesh, and stops listening to the subtree it took along', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const leaving = mesh();
    group.add(leaving);
    scene.add(group);
    const holders = new MaterialHolders(scene);
    const listener = firstListener(group, () => holders.current());
    expect(holders.current()).toEqual([leaving]);

    scene.remove(group);
    expect(holders.current()).toEqual([]);
    expect(group.hasEventListener('childadded', listener)).toBe(false);
    expect(group.hasEventListener('childremoved', listener)).toBe(false);
  });

  it('ignores changes to a subtree once it has left the root', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const traverse = vi.spyOn(scene, 'traverse');
    const holders = new MaterialHolders(scene);
    holders.current();
    scene.remove(group);
    holders.current();

    group.add(mesh());
    expect(holders.current()).toEqual([]);
    expect(traverse).toHaveBeenCalledTimes(2);
  });

  it('removes every listener on dispose, and walks afresh when read again', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const holders = new MaterialHolders(scene);
    const listener = firstListener(scene, () => holders.current());

    holders.dispose();
    expect(scene.hasEventListener('childadded', listener)).toBe(false);
    expect(group.hasEventListener('childremoved', listener)).toBe(false);

    const late = mesh();
    group.add(late);
    expect(holders.current()).toEqual([late]);
  });
});

/** The listener `collect` puts on `object`, captured while it runs. */
function firstListener(object: THREE.Object3D, collect: () => void): Parameters<THREE.Object3D['addEventListener']>[1] {
  const addEventListener = vi.spyOn(object, 'addEventListener');
  collect();
  const listener = addEventListener.mock.calls[0]?.[1];
  addEventListener.mockRestore();
  if (!listener) throw new Error('expected the tracker to listen on the object');
  return listener;
}
