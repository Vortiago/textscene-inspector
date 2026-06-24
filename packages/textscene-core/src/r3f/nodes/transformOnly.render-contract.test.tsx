/**
 * ADR-0008 rendered contract for every non-visual 3D type in the r3f barrel.
 *
 * Registry identity (each type → the shared Node3D component, AudioStreamPlayer
 * → base Node) is already pinned in nodes/physics/3d/transformBodies.test.tsx
 * and is NOT re-asserted here. This file pins what that identity MEANS when a
 * scene actually renders through the NodeDispatcher:
 *
 *   1. the node lands in the THREE scene as a plain Group (invisible intent —
 *      no gizmo, no placeholder),
 *   2. it contributes zero meshes/geometry of its own,
 *   3. its children inherit the node's Transform3D (world position = origin).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../parser/types';
import type { Transform3D } from '../../nodes/base/node3d/types';
import { NodeDispatcher } from '../NodeDispatcher';
import { SelectionProvider } from '../contexts/SelectionContext';

// Side-effect import: registers every node component (same barrel the apps use).
import './index';

// The transform-only set from r3f/nodes/index.ts ("Non-visual nodes" block).
// Path3D / PathFollow3D were removed by ADR-0018 (they now have their own
// components with selection-gated gizmos + curve following).
const TRANSFORM_ONLY_3D_TYPES = [
  'StaticBody3D',
  'RigidBody3D',
  'CharacterBody3D',
  'Area3D',
  'Skeleton3D',
  'GPUParticles3D',
] as const;

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
  it.each([...TRANSFORM_ONLY_3D_TYPES])(
    '%s renders a bare transform Group with zero own geometry',
    async (type) => {
      const renderer = await renderScene([subjectNode(type)]);
      const group = renderer.scene.findByProps({ name: 'Subject' });

      // 1. A plain THREE.Group — not a Mesh subclass, not the gray fallback.
      // (Checked structurally, not via instanceof: the R3F test renderer
      // carries its own three.js copy, so cross-copy instanceof is unreliable.)
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

      // The child renders inside the subject's transform group. (The
      // dispatcher inserts an unnamed pickable <group> per node, so walk
      // the ancestor chain rather than asserting the direct parent.)
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
