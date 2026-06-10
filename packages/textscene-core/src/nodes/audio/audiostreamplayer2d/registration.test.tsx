/**
 * AudioStreamPlayer2D registration contract: the parser reuses `parseNode2D`
 * (transform only) and the render component reuses the Node2D transform group
 * (ADR-0008 — invisible group that positions children, not a placeholder cube).
 */

import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import './index'; // parser registration side effect
import './index.r3f'; // render registration side effect
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { parseNode2D } from '../../base/node2d/parser';
import type { TscnNode } from '../../../parser/types';

const heading = {
  type: 'node',
  attributes: { type: 'AudioStreamPlayer2D', name: 'Music' },
};

function audioNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Music',
    type: 'AudioStreamPlayer2D',
    children: [],
    properties: parseNode2D(heading, raw),
  };
}

describe('AudioStreamPlayer2D parser registration', () => {
  it('registers in the NodeRegistry with the Node2D parser', () => {
    const registration = nodeRegistry.getRegistration('AudioStreamPlayer2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('parses the 2D transform; audio-only properties stay unparsed', () => {
    const registration = nodeRegistry.getRegistration('AudioStreamPlayer2D')!;
    const props = registration.parser(heading, {
      position: 'Vector2(100, 50)',
      stream: 'ExtResource("1_abc")',
    });
    expect(props.position).toEqual({ x: 100, y: 50 });
    expect(props.name).toBe('Music');
    expect('stream' in props).toBe(false);
  });

  it('matches only [node] headings of its own type', () => {
    expect(
      nodeRegistry.findRegistration({
        type: 'node',
        attributes: { type: 'AudioStreamPlayer2D', name: 'Music' },
      })
    ).not.toBeNull();
    expect(
      nodeRegistry.findRegistration({
        type: 'sub_resource',
        attributes: { type: 'AudioStreamPlayer2D' },
      })
    ).toBeNull();
  });
});

describe('AudioStreamPlayer2D render contract (ADR-0008)', () => {
  it('reuses the Node2D transform group, not a fallback placeholder', () => {
    expect(nodeComponentRegistry.get('AudioStreamPlayer2D')).toBe(Node2D);
  });

  it('renders an invisible group that positions children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('AudioStreamPlayer2D')!;
    const r = await ReactThreeTestRenderer.create(
      <Component node={audioNode({ position: 'Vector2(100, 50)' })}>
        <mesh name="child" />
      </Component>
    );

    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.type).toBe('Group');
    // Godot (100, 50) +Y-down → three.js (100, -50) (conjugated 2D frame).
    expect(group.position.x).toBeCloseTo(100, 5);
    expect(group.position.y).toBeCloseTo(-50, 5);
    // The child renders inside the group, so it inherits the transform…
    expect(group.children.some((c) => c.name === 'child')).toBe(true);
    // …and the group itself draws nothing: the only mesh is the child.
    const meshes: THREE.Object3D[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o);
    });
    expect(meshes.map((m) => m.name)).toEqual(['child']);
  });

  it('renders no geometry at all without children', async () => {
    const Component = nodeComponentRegistry.get('AudioStreamPlayer2D')!;
    const r = await ReactThreeTestRenderer.create(<Component node={audioNode()} />);
    const group = r.scene.children[0]!.instance as THREE.Group;
    let meshCount = 0;
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshCount += 1;
    });
    expect(meshCount).toBe(0);
  });
});
