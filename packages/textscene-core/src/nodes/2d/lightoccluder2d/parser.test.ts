/**
 * LightOccluder2D parser tests.
 */

import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseLightOccluder2D } from './parser';

describe('parseLightOccluder2D', () => {
  it('parses name, parent, and the 2D transform (happy path)', () => {
    const result = parseLightOccluder2D(
      heading('LightOccluder2D', { name: 'MyOcc', parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5', light_mask: '2', sdf_collision: 'false' }
    );
    expect(result.name).toBe('MyOcc');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
    expect(result.light_mask).toBe(2);
    expect(result.sdf_collision).toBe(false);
  });

  it('applies Godot defaults when LightOccluder2D-specific props are absent', () => {
    const result = parseLightOccluder2D(heading('LightOccluder2D', { name: 'NoProps' }), {});
    expect(result.name).toBe('NoProps');
    expect(result.light_mask).toBe(1);
    expect(result.sdf_collision).toBe(true);
    expect(result.occluder_light_mask).toBe(1);
    expect(result.occluder).toBeUndefined();
  });

  it('preserves an absent occluder as undefined', () => {
    const result = parseLightOccluder2D(heading('LightOccluder2D', { name: 'Occ' }), {
      light_mask: '1',
    });
    expect(result.occluder).toBeUndefined();
  });

  it('preserves an explicit occluder reference as a string', () => {
    const result = parseLightOccluder2D(heading('LightOccluder2D', { name: 'Occ' }), {
      occluder: 'SubResource("1")',
    });
    expect(result.occluder).toBe('SubResource("1")');
  });

  it('falls back to the identity transform on a malformed transform (error path)', () => {
    const result = parseLightOccluder2D(heading('LightOccluder2D', { name: 'Bad' }), {
      transform: 'Transform2D(not, valid)',
    });
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseLightOccluder2D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.light_mask).toBe(1);
    expect(result.sdf_collision).toBe(true);
  });
});
