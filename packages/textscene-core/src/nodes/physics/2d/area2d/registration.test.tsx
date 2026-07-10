/**
 * Area2D registration contract: dedicated parser (Node2D transform +
 * monitoring/layer/mask) with a Node2D transform-only render component
 * (ADR-0005/ADR-0008), registered as a CanvasItem type.
 */

import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import './index';
import './index.r3f';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../../base/node2d/Component';
import { parseArea2D } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node' as const, attributes: { type: 'Area2D', name: 'Trigger' } };

function areaNode(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Trigger', type: 'Area2D', children: [], properties: parseArea2D(heading, raw) };
}

describe('Area2D parser registration', () => {
  it('registers in the NodeRegistry with the dedicated parser', () => {
    const registration = nodeRegistry.getRegistration('Area2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseArea2D);
    expect(registration!.propertyFormatter).toBeDefined();
  });

  it('matches only [node] headings of its own type', () => {
    expect(nodeRegistry.findRegistration(heading)).not.toBeNull();
    expect(
      nodeRegistry.findRegistration({ type: 'sub_resource', attributes: { type: 'Area2D' } })
    ).toBeNull();
  });
});

describe('Area2D render contract', () => {
  it('reuses the Node2D transform group, registered as a CanvasItem', () => {
    expect(nodeComponentRegistry.get('Area2D')).toBe(Node2D);
    expect(nodeComponentRegistry.isCanvasItem('Area2D')).toBe(true);
  });

  it('renders an invisible group positioning children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('Area2D')!;
    const r = await ReactThreeTestRenderer.create(
      <Component node={areaNode({ position: 'Vector2(10, 20)' })}>
        <mesh name="child" />
      </Component>
    );
    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.position.x).toBeCloseTo(10, 5);
    expect(group.position.y).toBeCloseTo(-20, 5);
    expect(group.children.some((c) => c.name === 'child')).toBe(true);
  });
});
