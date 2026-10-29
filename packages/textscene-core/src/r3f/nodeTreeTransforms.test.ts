import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Transform3D } from '../godot/math/transform3d.js';
import { identityTransform3D, multiplyTransform3D, storedTransform3D } from '../godot/math/transform3d.js';
import { globalMatrix3D, matrixToTransform3D, realGlobalTransform3D } from './nodeTreeTransforms.js';

function translation(x: number, y: number, z: number): Transform3D {
  return { ...identityTransform3D(), origin: { x, y, z } };
}

function node(name: string, type: string, extra: Partial<TscnNode> = {}, transform?: Transform3D): TscnNode {
  return {
    rawProperties: {},
    name,
    type,
    children: [],
    properties: transform ? { transform } : {},
    ...extra,
  };
}

function originOf(path: string, nodes: TscnNode[], paths: string[]): number[] {
  const nodeByPath = new Map(paths.map((p, i) => [p, nodes[i]!]));
  const e = globalMatrix3D(path, nodeByPath).elements;
  return [e[12]!, e[13]!, e[14]!];
}

describe('globalMatrix3D', () => {
  it('composes a Node3D chain root to leaf', () => {
    const origin = originOf(
      'Root/A/B',
      [
        node('Root', 'Node3D', {}, translation(1, 0, 0)),
        node('A', 'Node3D', {}, translation(0, 2, 0)),
        node('B', 'Node3D', {}, translation(0, 0, 3)),
      ],
      ['Root', 'Root/A', 'Root/A/B']
    );
    expect(origin).toEqual([1, 2, 3]);
  });

  it('restarts below a plain Node, whose Node3D child has no Node3D parent', () => {
    const origin = originOf(
      'Root/Folder/Child',
      [
        node('Root', 'Node3D', {}, translation(5, 0, 0)),
        node('Folder', 'Node'),
        node('Child', 'Node3D', {}, translation(0, 1, 0)),
      ],
      ['Root', 'Root/Folder', 'Root/Folder/Child']
    );
    expect(origin).toEqual([0, 1, 0]);
  });

  it('gives a plain Node the identity, so it is a clean parent space', () => {
    const origin = originOf(
      'Root/Folder',
      [node('Root', 'Node3D', {}, translation(5, 0, 0)), node('Folder', 'Node')],
      ['Root', 'Root/Folder']
    );
    expect(origin).toEqual([0, 0, 0]);
  });

  it('passes through a type-less instance node, whose real class is the sub-scene root', () => {
    const origin = originOf(
      'Root/Inst/Child',
      [
        node('Root', 'Node3D', {}, translation(5, 0, 0)),
        node('Inst', 'Node', { instance: 'ExtResource("1")' }, translation(0, 2, 0)),
        node('Child', 'Node3D', {}, translation(0, 0, 1)),
      ],
      ['Root', 'Root/Inst', 'Root/Inst/Child']
    );
    expect(origin).toEqual([5, 2, 1]);
  });

  it('restarts at a top_level Node3D, whose global transform is its local one', () => {
    const origin = originOf(
      'Root/Free/Leaf',
      [
        node('Root', 'Node3D', {}, translation(5, 0, 0)),
        node('Free', 'Node3D', { properties: { transform: translation(0, 2, 0), top_level: true } }),
        node('Leaf', 'Node3D', {}, translation(0, 0, 1)),
      ],
      ['Root', 'Root/Free', 'Root/Free/Leaf']
    );
    expect(origin).toEqual([0, 2, 1]);
  });
});

describe('realGlobalTransform3D', () => {
  // A parent turned and scaled so the double and float products round apart.
  function chain(): { parent: THREE.Group; child: THREE.Group } {
    const parent = new THREE.Group();
    parent.position.set(0.1, 0.2, 0.3);
    parent.rotation.set(0.3, 0.7, 0.1);
    parent.scale.set(1.7, 0.3, 2.9);
    const child = new THREE.Group();
    child.position.set(0.7, -1.3, 0.11);
    child.rotation.set(-0.2, 0.4, 1.1);
    parent.add(child);
    parent.updateMatrixWorld();
    return { parent, child };
  }

  // `node_3d.cpp:655-660`: the parent's global transform times the local one, in `real_t` float.
  it("composes each ancestor's float local transform from the root, in float", () => {
    const { parent, child } = chain();
    const local = (object: THREE.Object3D) => storedTransform3D(matrixToTransform3D(object.matrix));
    expect(realGlobalTransform3D(child)).toEqual(multiplyTransform3D(local(parent), local(child)));
  });

  it("differs from three's double product, which Godot never computes", () => {
    const { child } = chain();
    expect(realGlobalTransform3D(child)).not.toEqual(
      storedTransform3D(matrixToTransform3D(child.matrixWorld))
    );
  });
});
