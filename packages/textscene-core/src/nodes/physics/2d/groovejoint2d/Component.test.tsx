/** <GrooveJoint2D> draws its marker at the authored lengths, in Godot's y-down pixels. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { GizmoScene } from '../../../../r3f/testing/GizmoScene';
import type { TscnNode } from '../../../../parser/types';
import { GrooveJoint2D } from './Component';
import { parseGrooveJoint2D } from './parser';

function jointNode(properties: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Joint',
    type: 'GrooveJoint2D',
    children: [],
    properties: parseGrooveJoint2D(
      { type: 'node', attributes: { type: 'GrooveJoint2D', name: 'Joint' } },
      properties
    ),
  };
}

async function positionsOf(properties: Record<string, string>) {
  const renderer = await ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Joint" selectedPath={null} showGizmos>
      <GrooveJoint2D node={jointNode(properties)} />
    </GizmoScene>
  );
  return renderer.scene
    .findAllByType('Mesh')
    .map((mesh) => (mesh.instance as THREE.Mesh).geometry.getAttribute('position'));
}

function ysOf(positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number[] {
  return Array.from({ length: positions.count }, (_, i) => positions.getY(i));
}

describe('<GrooveJoint2D>', () => {
  it('puts the far bar at the authored length, down the screen', async () => {
    const [frame] = await positionsOf({ length: '60', initial_offset: '20' });
    expect(Math.min(...ysOf(frame!))).toBeCloseTo(-61.5, 5); // length 60, plus half the 3 px bar
  });

  it('puts the offset bar at the authored initial_offset', async () => {
    const [, offset] = await positionsOf({ length: '60', initial_offset: '20' });
    expect(Math.min(...ysOf(offset!))).toBeCloseTo(-22.5, 5); // offset 20, plus half the 5 px bar
    expect(Math.max(...ysOf(offset!))).toBeCloseTo(-17.5, 5);
  });
});
