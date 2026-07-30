import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseParallaxLayer } from './parser';

describe('parseParallaxLayer', () => {
  it('parses name, parent, and the 2D transform (happy path)', () => {
    const result = parseParallaxLayer(
      heading('ParallaxLayer', { name: 'MyParallaxLayer', parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5' }
    );
    expect(result.name).toBe('MyParallaxLayer');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
  });

  it('falls back to the identity transform on a malformed transform (error path)', () => {
    const result = parseParallaxLayer(
      heading('ParallaxLayer', { name: 'Bad' }),
      { transform: 'Transform2D(not, valid)' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseParallaxLayer({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('parses the motion surface with Godot defaults', () => {
    const result = parseParallaxLayer(heading('ParallaxLayer', { name: 'Sky' }), {
      motion_scale: 'Vector2(0.2, 1)',
      motion_offset: 'Vector2(-550, 0)',
      motion_mirroring: 'Vector2(400, 0)',
    });
    expect(result.motion_scale).toEqual({ x: 0.2, y: 1 });
    expect(result.motion_offset).toEqual({ x: -550, y: 0 });
    expect(result.motion_mirroring).toEqual({ x: 400, y: 0 });

    const bare = parseParallaxLayer(heading('ParallaxLayer', { name: 'Bare' }), {});
    expect(bare.motion_scale).toEqual({ x: 1, y: 1 });
    expect(bare.motion_offset).toEqual({ x: 0, y: 0 });
    expect(bare.motion_mirroring).toEqual({ x: 0, y: 0 });
  });

  it('clamps a negative motion_mirroring to zero, per `p_mirroring.maxf(0)`', () => {
    const result = parseParallaxLayer(heading('ParallaxLayer', { name: 'Neg' }), {
      motion_mirroring: 'Vector2(-400, -1)',
    });
    expect(result.motion_mirroring).toEqual({ x: 0, y: 0 });
  });
});
