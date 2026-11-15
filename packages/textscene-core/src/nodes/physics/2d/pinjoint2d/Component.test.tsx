/** <PinJoint2D> draws two 20 px bars crossing at its origin (`pin_joint_2d.cpp:45-46`). */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { GizmoScene } from '../../../../r3f/testing/GizmoScene';
import type { TscnNode } from '../../../../parser/types';
import { parseNode2D } from '../../../base/node2d/parser';
import { PinJoint2D } from './Component';

const node: TscnNode = {
  rawProperties: {},
  name: 'Joint',
  type: 'PinJoint2D',
  children: [],
  properties: parseNode2D({ type: 'node', attributes: { type: 'PinJoint2D', name: 'Joint' } }, {}),
};

describe('<PinJoint2D>', () => {
  it('draws the two bars as one quad mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GizmoScene nodePath="Joint" selectedPath={null} showGizmos>
        <PinJoint2D node={node} />
      </GizmoScene>
    );
    const marker = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(marker.geometry.getAttribute('position').count).toBe(2 * 4);
  });
});
