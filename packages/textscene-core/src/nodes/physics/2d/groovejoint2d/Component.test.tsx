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

async function frameOf(properties: Record<string, string>) {
  const renderer = await ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Joint" selectedPath={null} showGizmos>
      <GrooveJoint2D node={jointNode(properties)} />
    </GizmoScene>
  );
  const [frame] = renderer.scene.findAllByType('Mesh');
  return (frame!.instance as THREE.Mesh).geometry.getAttribute('position');
}

describe('<GrooveJoint2D>', () => {
  it('puts the far bar at the authored length, down the screen', async () => {
    const positions = await frameOf({ length: '60', initial_offset: '20' });
    const ys = Array.from({ length: positions.count }, (_, i) => positions.getY(i));
    expect(Math.min(...ys)).toBe(-61.5); // length 60, plus half the 3 px bar
  });
});
