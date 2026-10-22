import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { NodeDispatcher } from '../../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import { visibleInTree } from '../../../../r3f/visibleInTree';
import { parseCSGCombiner3D } from './parser';
import './index.r3f';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { drawnMeshes } from '../../testing/reactThreeTestInstance';

const CSGCombiner3D = registeredComponent('CSGCombiner3D');
// Imports the wired slice, not the bare component: CsgPrimitive builds the solid
// from the registered builder, so the registration is part of what is under test.

function makeNode(overrides: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  const properties = parseCSGCombiner3D(
    { type: 'node', attributes: { type: 'CSGCombiner3D', name: 'Combiner' } },
    overrides
  );
  return { rawProperties: {}, name: 'Combiner', type: 'CSGCombiner3D', children, properties };
}

describe('<CSGCombiner3D>', () => {
  it('draws nothing of its own', async () => {
    // Godot's combiner has no shape: _build_brush() returns an empty brush. It is the
    // node whose boolean fold of its children becomes the shape.
    const renderer = await ReactThreeTestRenderer.create(<CSGCombiner3D node={makeNode()} />);
    expect(drawnMeshes(renderer.scene)).toHaveLength(0);
  });

  it('positions children at its transform', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CSGCombiner3D node={makeNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)' })}>
        <mesh name="child" />
      </CSGCombiner3D>
    );
    expect((renderer.scene.findByType('Group').instance as THREE.Group).position.y).toBeCloseTo(2, 5);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('hides its subtree through the dispatcher when visible = false', async () => {
    // The vendored witness: ragdoll_physics.tscn:92 hides its combiner because the same
    // geometry is already baked into sibling nodes.
    const child: TscnNode = {
      rawProperties: {},
      name: 'child',
      type: 'Node3D',
      children: [],
      properties: { name: 'child' },
    };
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={[makeNode({ visible: 'false' }, [child])]} />
      </SelectionProvider>
    );
    // The child stays mounted, and three hides the subtree through the dispatcher's group.
    // Unmounting it would break the subtree-conformance contract.
    expect(visibleInTree(renderer.scene.findByProps({ name: 'child' }).instance)).toBe(false);
  });
});
