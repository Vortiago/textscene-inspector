/**
 * ADR-0008's rendered contract for every non-visual 3D type: a plain Group with no
 * mesh of its own, whose children inherit its Transform3D. Registry identity is
 * pinned in nodes/physics/3d/transformBodies.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../parser/types';
import type { Transform3D } from '../../nodes/base/node3d/types';
import { NodeDispatcher } from '../NodeDispatcher';
import { SelectionProvider } from '../contexts/SelectionContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { Node3D } from '../../nodes/base/node3d/Component';

// Side-effect import: registers every node component (same barrel the apps use).
import './index';

/**
 * Derived from `renderIntent: 'transform-only'`, so a new slice joins on
 * registration. Only the Node3D-backed types: Node and Node2D ones carry no
 * Transform3D, and ADR-0018 gave Path3D and PathFollow3D gizmo components.
 */
const TRANSFORM_ONLY_3D_TYPES = nodeComponentRegistry
  .getAllTypeNames()
  .filter(
    (type) =>
      nodeComponentRegistry.isTransformOnly(type) && nodeComponentRegistry.get(type) === Node3D
  )
  .sort();

// Identity basis translated to (2, 3, 4).
const translated: Transform3D = {
  basis_x: { x: 1, y: 0, z: 0 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: { x: 2, y: 3, z: 4 },
};

function subjectNode(type: string, children: TscnNode[] = []): TscnNode {
  return {
    name: 'Subject',
    type,
    children,
    properties: { name: 'Subject', transform: translated },
  };
}

async function renderScene(nodes: TscnNode[]) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <NodeDispatcher nodes={nodes} />
    </SelectionProvider>
  );
}

describe('transform-only 3D types: rendered contract (ADR-0008)', () => {
  it('derives a non-trivial set, so an empty filter cannot vacuously pass', () => {
    expect(TRANSFORM_ONLY_3D_TYPES.length).toBeGreaterThanOrEqual(10);
    // A physics body is the safe anchor: ADR-0005 settled it and Godot draws
    // nothing for one at runtime, so it cannot be re-classified out from under
    // this assertion the way a contested type could.
    expect(TRANSFORM_ONLY_3D_TYPES).toContain('StaticBody3D');
  });

  it.each([...TRANSFORM_ONLY_3D_TYPES])(
    '%s renders a bare transform Group with zero own geometry',
    async (type) => {
      const renderer = await renderScene([subjectNode(type)]);
      const group = renderer.scene.findByProps({ name: 'Subject' });

      // 1. A plain THREE.Group, not a Mesh or the grey fallback. Checked by type,
      // since the test renderer carries its own three.js copy.
      expect(group.instance.type).toBe('Group');
      expect((group.instance as THREE.Group).isGroup).toBe(true);
      expect(group.instance.userData.isPlaceholder).toBeUndefined();

      // 2. The node transform is applied to that group.
      expect(group.instance.position.toArray()).toEqual([2, 3, 4]);
      expect(group.instance.visible).toBe(true);

      // 3. Nothing in the whole rendered scene owns a mesh or geometry.
      expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    }
  );

  it.each([...TRANSFORM_ONLY_3D_TYPES])(
    '%s positions its children by the node transform',
    async (type) => {
      const child: TscnNode = {
        name: 'Kid',
        type: 'Node3D',
        children: [],
        properties: { name: 'Kid' }, // identity transform of its own
      };
      const renderer = await renderScene([subjectNode(type, [child])]);
      const kid = renderer.scene.findByProps({ name: 'Kid' });

      // The child renders inside the subject's transform group. The dispatcher
      // inserts an unnamed pickable <group> per node, so walk the ancestors.
      const ancestorNames: string[] = [];
      for (let p = kid.instance.parent; p; p = p.parent) ancestorNames.push(p.name);
      expect(ancestorNames).toContain('Subject');

      // World position = the parent's Transform3D origin: the transform is
      // applied by the group and inherited, not re-applied per child.
      const world = kid.instance.getWorldPosition(new THREE.Vector3());
      expect(world.toArray()).toEqual([2, 3, 4]);
    }
  );
});
