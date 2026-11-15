/** <DampedSpringJoint2D> draws its marker at the authored lengths, in Godot's y-down pixels. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { GizmoScene } from '../../../../r3f/testing/GizmoScene';
import type { TscnNode } from '../../../../parser/types';
import { DampedSpringJoint2D } from './Component';
import { parseDampedSpringJoint2D } from './parser';

function jointNode(properties: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Joint',
    type: 'DampedSpringJoint2D',
    children: [],
    properties: parseDampedSpringJoint2D(
      { type: 'node', attributes: { type: 'DampedSpringJoint2D', name: 'Joint' } },
      properties
    ),
  };
}

async function frameOf(properties: Record<string, string>) {
  const renderer = await ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Joint" selectedPath={null} showGizmos>
      <DampedSpringJoint2D node={jointNode(properties)} />
    </GizmoScene>
  );
  const [frame] = renderer.scene.findAllByType('Mesh');
  return (frame!.instance as THREE.Mesh).geometry.getAttribute('position');
}

describe('<DampedSpringJoint2D>', () => {
  it('puts the far bar at the authored length, down the screen', async () => {
    const positions = await frameOf({ length: '80' });
    const ys = Array.from({ length: positions.count }, (_, i) => positions.getY(i));
    expect(Math.min(...ys)).toBe(-81.5); // length 80, plus half the 3 px bar
  });
});
