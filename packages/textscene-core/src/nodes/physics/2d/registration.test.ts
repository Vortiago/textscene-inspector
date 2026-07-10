import { describe, it, expect } from 'vitest';
import './index.r3f'; // triggers both parser (./index) and render registration
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { TWO_D_PHYSICS_TYPES } from './index';

describe('2D physics body render registration', () => {
  it('registers a render Component for every 2D physics type', () => {
    for (const typeName of TWO_D_PHYSICS_TYPES) {
      expect(nodeComponentRegistry.get(typeName)).toBeDefined();
    }
  });

  it('covers the remaining transform-only bodies (StaticBody2D, RigidBody2D, CharacterBody2D)', () => {
    expect(TWO_D_PHYSICS_TYPES).toEqual(['StaticBody2D', 'RigidBody2D', 'CharacterBody2D']);
  });

  it('no longer covers Area2D/CollisionShape2D — they moved to their own slices', () => {
    expect(TWO_D_PHYSICS_TYPES).not.toContain('Area2D');
    expect(TWO_D_PHYSICS_TYPES).not.toContain('CollisionShape2D');
  });
});
