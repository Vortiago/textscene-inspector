import { describe, it, expect } from 'vitest';
import { parseAnimatedSprite2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

const heading = (attrs: Record<string, string> = {}): ParsedHeading => ({
  type: 'node',
  attributes: { type: 'AnimatedSprite2D', name: 'Anim', ...attrs },
});

describe('parseAnimatedSprite2D', () => {
  it('parses sprite_frames ref + unwraps the &"name" StringName', () => {
    const p = parseAnimatedSprite2D(heading(), {
      sprite_frames: 'SubResource("1")',
      animation: '&"right"',
      frame: '1',
    });
    expect(p.sprite_frames).toBe('SubResource("1")');
    expect(p.animation).toBe('right');
    expect(p.frame).toBe(1);
  });

  it('defaults (centered true, frame 0, no animation)', () => {
    const p = parseAnimatedSprite2D(heading(), {});
    expect(p.centered).toBe(true);
    expect(p.frame).toBe(0);
    expect(p.animation).toBeUndefined();
    expect(p.sprite_frames).toBeUndefined();
  });

  it('inherits Node2D transform (scale) + modulate', () => {
    const p = parseAnimatedSprite2D(heading(), { scale: 'Vector2(0.5, 0.5)' });
    expect(p.scale).toEqual({ x: 0.5, y: 0.5 });
    expect(p.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});
