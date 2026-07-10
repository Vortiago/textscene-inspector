import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCollisionShape2D } from './parser';

describe('parseCollisionShape2D', () => {
  it('parses the shape reference and disabled flag (happy path)', () => {
    const result = parseCollisionShape2D(
      heading('CollisionShape2D', { name: 'Shape', parent: '.' }),
      { shape: 'SubResource("CircleShape2D_1")', disabled: 'true' }
    );
    expect(result.name).toBe('Shape');
    expect(result.shape).toBe('SubResource("CircleShape2D_1")');
    expect(result.disabled).toBe(true);
  });

  it('leaves shape/disabled undefined when absent (edge case)', () => {
    const result = parseCollisionShape2D(heading('CollisionShape2D', { name: 'Bare' }), {});
    expect(result.shape).toBeUndefined();
    expect(result.disabled).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('falls back to the identity transform on a malformed Transform2D (error path)', () => {
    const result = parseCollisionShape2D(heading('CollisionShape2D', { name: 'Bad' }), {
      transform: 'Transform2D(bad)',
    });
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });
});
