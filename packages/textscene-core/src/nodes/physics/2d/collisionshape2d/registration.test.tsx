/**
 * CollisionShape2D registration contract: dedicated parser (shape + disabled)
 * with a dedicated render component drawing a toggleable outline gizmo,
 * registered as a CanvasItem type.
 */

import { describe, it, expect } from 'vitest';
import './index';
import './index.r3f';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CollisionShape2D } from './Component';
import { parseCollisionShape2D } from './parser';

const heading = { type: 'node' as const, attributes: { type: 'CollisionShape2D', name: 'Col' } };

describe('CollisionShape2D parser registration', () => {
  it('registers in the NodeRegistry with the dedicated parser', () => {
    const registration = nodeRegistry.getRegistration('CollisionShape2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseCollisionShape2D);
  });

  it('matches only [node] headings of its own type', () => {
    expect(nodeRegistry.findRegistration(heading)).not.toBeNull();
    expect(
      nodeRegistry.findRegistration({ type: 'sub_resource', attributes: { type: 'CollisionShape2D' } })
    ).toBeNull();
  });
});

describe('CollisionShape2D render contract', () => {
  it('registers the dedicated gizmo component as a CanvasItem', () => {
    expect(nodeComponentRegistry.get('CollisionShape2D')).toBe(CollisionShape2D);
    expect(nodeComponentRegistry.isCanvasItem('CollisionShape2D')).toBe(true);
  });
});
