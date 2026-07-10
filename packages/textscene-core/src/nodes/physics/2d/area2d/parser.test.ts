import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseArea2D } from './parser';

describe('parseArea2D', () => {
  it('parses the 2D transform plus monitoring/layer/mask (happy path)', () => {
    const result = parseArea2D(
      heading('Area2D', { name: 'Trigger', parent: '.' }),
      { position: 'Vector2(10, 20)', monitoring: 'true', monitorable: 'false', collision_layer: '4', collision_mask: '1' }
    );
    expect(result.name).toBe('Trigger');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.monitoring).toBe(true);
    expect(result.monitorable).toBe(false);
    expect(result.collision_layer).toBe(4);
    expect(result.collision_mask).toBe(1);
  });

  it('leaves monitoring/layer/mask undefined when absent (edge case)', () => {
    const result = parseArea2D(heading('Area2D', { name: 'Bare' }), {});
    expect(result.monitoring).toBeUndefined();
    expect(result.monitorable).toBeUndefined();
    expect(result.collision_layer).toBeUndefined();
    expect(result.collision_mask).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('falls back to the identity transform on a malformed Transform2D (error path)', () => {
    const result = parseArea2D(heading('Area2D', { name: 'Bad' }), {
      transform: 'Transform2D(bad)',
    });
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });
});
