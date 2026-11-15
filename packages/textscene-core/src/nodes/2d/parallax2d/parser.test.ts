import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseParallax2D } from './parser';

const parse = (properties: Record<string, string> = {}) =>
  parseParallax2D(heading('Parallax2D', { name: 'P' }), properties);

describe('parseParallax2D', () => {
  it('holds the Godot defaults when no key is authored', () => {
    // parallax_2d.h:41-51
    const result = parse();
    expect(result.scroll_scale).toEqual({ x: 1, y: 1 });
    expect(result.scroll_offset).toEqual({ x: 0, y: 0 });
    expect(result.screen_offset).toEqual({ x: 0, y: 0 });
    expect(result.repeat_size).toEqual({ x: 0, y: 0 });
    expect(result.repeat_times).toBe(1);
    expect(result.limit_begin).toEqual({ x: -10000000, y: -10000000 });
    expect(result.limit_end).toEqual({ x: 10000000, y: 10000000 });
    expect(result.follow_viewport).toBe(true);
    expect(result.ignore_camera_scroll).toBe(false);
  });

  it('reads every authored key', () => {
    const result = parse({
      scroll_scale: 'Vector2(0.5, 2)',
      scroll_offset: 'Vector2(100, 20)',
      screen_offset: 'Vector2(50, 0)',
      repeat_size: 'Vector2(200, 0)',
      repeat_times: '3',
      limit_begin: 'Vector2(60, -5)',
      limit_end: 'Vector2(2000, 5)',
      follow_viewport: 'false',
      ignore_camera_scroll: 'true',
    });
    expect(result.scroll_scale).toEqual({ x: 0.5, y: 2 });
    expect(result.scroll_offset).toEqual({ x: 100, y: 20 });
    expect(result.screen_offset).toEqual({ x: 50, y: 0 });
    expect(result.repeat_size).toEqual({ x: 200, y: 0 });
    expect(result.repeat_times).toBe(3);
    expect(result.limit_begin).toEqual({ x: 60, y: -5 });
    expect(result.limit_end).toEqual({ x: 2000, y: 5 });
    expect(result.follow_viewport).toBe(false);
    expect(result.ignore_camera_scroll).toBe(true);
  });

  it('clamps a negative repeat_size component to 0 and repeat_times below 1 to 1', () => {
    // set_repeat_size `maxf(0)` (parallax_2d.cpp:165), set_repeat_times `MAX(.., 1)` (:181)
    const result = parse({ repeat_size: 'Vector2(-30, 40)', repeat_times: '0' });
    expect(result.repeat_size).toEqual({ x: 0, y: 40 });
    expect(result.repeat_times).toBe(1);
  });

  it('keeps the Node2D transform', () => {
    expect(parse({ scale: 'Vector2(0.5, 1)' }).scale).toEqual({ x: 0.5, y: 1 });
  });
});
