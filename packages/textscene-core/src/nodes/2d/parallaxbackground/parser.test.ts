import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseParallaxBackground } from './parser';

describe('parseParallaxBackground', () => {
  it('parses the scroll surface and the CanvasLayer placement (happy path)', () => {
    const result = parseParallaxBackground(
      heading('ParallaxBackground', { name: 'MyParallaxBackground', parent: '.' }),
      {
        offset: 'Vector2(10, -20)',
        scale: 'Vector2(2, 2)',
        rotation: '1.5',
        scroll_base_offset: 'Vector2(5, 6)',
        scroll_base_scale: 'Vector2(0.1, 0)',
        scroll_limit_begin: 'Vector2(-100, -50)',
        scroll_limit_end: 'Vector2(900, 500)',
        scroll_ignore_camera_zoom: 'true',
        follow_viewport_enabled: 'true',
      }
    );
    expect(result.name).toBe('MyParallaxBackground');
    expect(result.parent).toBe('.');
    expect(result.offset).toEqual({ x: 10, y: -20 });
    expect(result.scale).toEqual({ x: 2, y: 2 });
    expect(result.rotation).toBe(1.5);
    expect(result.scroll_base_offset).toEqual({ x: 5, y: 6 });
    expect(result.scroll_base_scale).toEqual({ x: 0.1, y: 0 });
    expect(result.scroll_limit_begin).toEqual({ x: -100, y: -50 });
    expect(result.scroll_limit_end).toEqual({ x: 900, y: 500 });
    expect(result.scroll_ignore_camera_zoom).toBe(true);
    expect(result.follow_viewport_enabled).toBe(true);
  });

  it('defaults `layer` to -100, the class default a .tscn omits', () => {
    const result = parseParallaxBackground(heading('ParallaxBackground', { name: 'BG' }), {});
    expect(result.layer).toBe(-100);
    expect(parseParallaxBackground(heading('ParallaxBackground', {}), { layer: '5' }).layer).toBe(5);
  });

  it('lets the composite `transform` win over offset/rotation/scale', () => {
    // An instance override can write all three: Godot serialises them and
    // applies `transform` last.
    const result = parseParallaxBackground(heading('ParallaxBackground', { name: 'BG' }), {
      offset: 'Vector2(0, -427)',
      scale: 'Vector2(0.5, 0.5)',
      transform: 'Transform2D(0.5, 0, 0, 0.5, 0, -427)',
    });
    expect(result.offset).toEqual({ x: 0, y: -427 });
    expect(result.scale.x).toBeCloseTo(0.5, 10);
    expect(result.scale.y).toBeCloseTo(0.5, 10);
    expect(result.rotation).toBeCloseTo(0, 10);
  });

  it('falls back to the identity placement on a malformed transform (error path)', () => {
    const result = parseParallaxBackground(heading('ParallaxBackground', { name: 'Bad' }), {
      transform: 'Transform2D(not, valid)',
    });
    expect(result.offset).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseParallaxBackground({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.visible).toBeUndefined();
    expect(result.scroll_base_scale).toEqual({ x: 1, y: 1 });
    expect(result.follow_viewport_scale).toBe(1);
    expect(result.scroll_ignore_camera_zoom).toBe(false);
  });
});
