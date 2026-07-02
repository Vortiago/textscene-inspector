import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseNode2D } from '../../base/node2d/parser';

describe('parseNode2D (physics bodies)', () => {
  it('parses Area2D with discrete transform properties', () => {
    const result = parseNode2D(
      heading('Area2D', { parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5' }
    );
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
    expect(result.name).toBe('Area2D');
    expect(result.parent).toBe('.');
  });

  it('parses RigidBody2D with physics-only properties without error', () => {
    const result = parseNode2D(
      heading('RigidBody2D', { parent: '.' }),
      { mass: '1', collision_layer: '8' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
    expect(result.name).toBe('RigidBody2D');
  });

  it('falls back to identity on malformed Transform2D', () => {
    const result = parseNode2D(
      heading('StaticBody2D', { parent: '.' }),
      { transform: 'Transform2D(bad)' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.rotation).toBe(0);
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });
});
