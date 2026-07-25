import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { GenericNodeFallback } from '../../../../r3f/internal/generic-node-fallback/Component';
import { parseCSGCombiner3D } from './parser';
import { CSGCombiner3D } from './Component';

function makeNode(overrides: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  const properties = parseCSGCombiner3D(
    { type: 'node', attributes: { type: 'CSGCombiner3D', name: 'Combiner' } },
    overrides
  );
  return { name: 'Combiner', type: 'CSGCombiner3D', children, properties };
}

describe('<CSGCombiner3D>', () => {
  it('draws nothing of its own', async () => {
    // Godot's combiner has no shape: _build_brush() returns an empty brush. It is the
    // node whose boolean fold of its CHILDREN becomes the shape.
    const renderer = await ReactThreeTestRenderer.create(<CSGCombiner3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
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

  it('hides its subtree when visible = false', async () => {
    // The vendored witness: ragdoll_physics.tscn:92 hides its combiner because the same
    // geometry is already baked into sibling nodes.
    const renderer = await ReactThreeTestRenderer.create(
      <CSGCombiner3D node={makeNode({ visible: 'false' })}>
        <mesh name="child" />
      </CSGCombiner3D>
    );
    expect((renderer.scene.findByType('Group').instance as THREE.Group).visible).toBe(false);
    // The child stays MOUNTED; three hides the subtree via the group. Unmounting it
    // instead would break the subtree-conformance contract.
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('is why registering the type matters: the generic fallback ignores visible', async () => {
    // This is the behaviour difference the slice buys before boolean evaluation exists.
    // GenericNodeFallback renders a group with no `visible` prop, so a hidden combiner's
    // children keep drawing.
    const node = makeNode({ visible: 'false' });
    const fallback = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node} />);
    expect((fallback.scene.findByType('Group').instance as THREE.Group).visible).toBe(true);

    const registered = await ReactThreeTestRenderer.create(<CSGCombiner3D node={node} />);
    expect((registered.scene.findByType('Group').instance as THREE.Group).visible).toBe(false);
  });
});
