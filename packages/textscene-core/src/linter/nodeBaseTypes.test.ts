/**
 * Integrity of the node base-type table: every chain must terminate (no
 * cycles), every subclass must resolve to the base that carries its validators,
 * and every node type the linter registers validators for must be reachable.
 */

import { describe, it, expect } from 'vitest';
import { NODE_BASE_TYPES } from '../godot/nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from '../godot/resourceBaseTypes.generated.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js'; // trigger all validator registrations
import { registeredTypes } from './registryPopulation.js';

/** Walk base → base to the root, returning the full chain (throws on a cycle). */
function chain(type: string): string[] {
  const seen: string[] = [];
  let current: string | undefined = type;
  while (current) {
    if (seen.includes(current)) {
      throw new Error(`cycle in NODE_BASE_TYPES at ${current}: ${seen.join(' → ')}`);
    }
    seen.push(current);
    current = NODE_BASE_TYPES[current];
  }
  return seen;
}

describe('NODE_BASE_TYPES', () => {
  it('has no cycles and every chain terminates at Node', () => {
    for (const type of Object.keys(NODE_BASE_TYPES)) {
      const c = chain(type);
      expect(c[c.length - 1]).toBe('Node');
    }
  });

  it('routes concrete light types through Light3D then Node3D', () => {
    for (const t of ['DirectionalLight3D', 'OmniLight3D', 'SpotLight3D', 'AreaLight3D']) {
      const c = chain(t);
      expect(c, `${t} should pass through Light3D`).toContain('Light3D');
      expect(c, `${t} should pass through Node3D`).toContain('Node3D');
      expect(c[c.length - 1]).toBe('Node');
    }
  });

  it('routes spatial nodes through Node3D', () => {
    expect(chain('MeshInstance3D')).toContain('Node3D');
    expect(chain('Camera3D')).toContain('Node3D');
    expect(chain('CollisionShape3D')).toContain('Node3D');
  });

  it('routes canvas nodes through Node2D', () => {
    expect(chain('Sprite2D')).toContain('Node2D');
    expect(chain('AnimatedSprite2D')).toContain('Node2D');
    expect(chain('TileMapLayer')).toContain('Node2D');
  });

  it('routes the Control family through Control', () => {
    for (const t of ['Label', 'Button', 'TextureRect', 'Panel', 'PanelContainer', 'HBoxContainer']) {
      expect(chain(t)).toContain('Control');
    }
  });

  it('does NOT route CanvasLayer through Control (it descends from Node)', () => {
    expect(chain('CanvasLayer')).not.toContain('Control');
    expect(chain('CanvasLayer')).toEqual(['CanvasLayer', 'Node']);
  });

  it('gives every registered type a resolvable chain to its root', () => {
    // A registered type that reaches neither root silently receives no
    // inherited validation, which is what this guards. Which hierarchy a type
    // belongs to is read from the tables, never from a hand-kept list, which a
    // new registration would fail rather than be checked by.
    for (const type of registeredTypes('declaring')) {
      const root = validatorRegistry.baseChainOf(type).at(-1) ?? type;
      expect([root, type], `${type} reaches no root`).toContain(
        type in RESOURCE_BASE_TYPES_GENERATED || type === 'Resource' ? 'Resource' : 'Node'
      );
    }
  });
});
