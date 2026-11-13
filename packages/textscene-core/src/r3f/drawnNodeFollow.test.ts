import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DrawnNodeFollow } from './drawnNodeFollow';

/** A registered wrapper that holds the drawn group of the node `name`, as `NodeDispatcher` mounts one. */
function mountNode(parent: THREE.Object3D, name: string): { wrapper: THREE.Object3D; drawn: THREE.Object3D } {
  const wrapper = new THREE.Group();
  const drawn = new THREE.Group();
  drawn.name = name;
  wrapper.add(drawn);
  parent.add(wrapper);
  return { wrapper, drawn };
}

function drawnScene(): { registry: Map<string, THREE.Object3D>; a: THREE.Object3D; b: THREE.Object3D } {
  const root = new THREE.Scene();
  const a = mountNode(root, 'A');
  const b = mountNode(a.drawn, 'B');
  root.updateMatrixWorld();
  return {
    registry: new Map([
      ['Root/A', a.wrapper],
      ['Root/A/B', b.wrapper],
    ]),
    a: a.drawn,
    b: b.drawn,
  };
}

describe('DrawnNodeFollow', () => {
  it('gives the drawn object at each path, in the order of the paths', () => {
    const { registry, a, b } = drawnScene();
    expect(new DrawnNodeFollow(registry, ['Root/A/B', 'Root/A']).objects()).toEqual([b, a]);
  });

  it('gives null while a path has no drawn object', () => {
    const { registry } = drawnScene();
    expect(new DrawnNodeFollow(registry, ['Root/A', 'Root/Missing']).objects()).toBeNull();
  });

  it('finds an object that mounts after the first lookup', () => {
    const { registry } = drawnScene();
    const follow = new DrawnNodeFollow(registry, ['Root/A', 'Root/Late']);
    follow.objects();
    const late = mountNode(new THREE.Scene(), 'Late');
    registry.set('Root/Late', late.wrapper);
    expect(follow.objects()?.[1]).toBe(late.drawn);
  });

  it('reports a move on the first call and after an object moves, and none between', () => {
    const { registry, a, b } = drawnScene();
    const follow = new DrawnNodeFollow(registry, ['Root/A', 'Root/A/B']);
    const objects = follow.objects()!;
    const seen = [follow.hasMoved(objects), follow.hasMoved(objects)];
    b.position.set(5, 0, 0);
    a.updateMatrixWorld(true);
    seen.push(follow.hasMoved(objects), follow.hasMoved(objects));
    expect(seen).toEqual([true, false, true, false]);
  });

  it('reports a move for the objects a later lookup finds', () => {
    const { registry } = drawnScene();
    const follow = new DrawnNodeFollow(registry, ['Root/A']);
    follow.hasMoved(follow.objects()!);
    registry.set('Root/Other', mountNode(new THREE.Scene(), 'Other').wrapper);
    expect(follow.hasMoved(follow.objects()!)).toBe(true);
  });
});
