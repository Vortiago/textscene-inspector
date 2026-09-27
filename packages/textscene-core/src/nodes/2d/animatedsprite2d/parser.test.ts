import { describe, it, expect } from 'vitest';
import { parseAnimatedSprite2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseAnimatedSprite2D', () => {
  it('parses sprite_frames ref + unwraps the &"name" StringName', () => {
    const p = parseAnimatedSprite2D(heading('AnimatedSprite2D', { name: 'Anim' }), {
      sprite_frames: 'SubResource("1")',
      animation: '&"right"',
      frame: '1',
    });
    expect(p.sprite_frames).toBe('SubResource("1")');
    expect(p.animation).toBe('right');
    expect(p.frame).toBe(1);
  });

  it('decodes the escapes of an animation name, as the SpriteFrames decoder does', () => {
    const p = parseAnimatedSprite2D(heading('AnimatedSprite2D', { name: 'Anim' }), {
      animation: '&"Say \\"hi\\""',
    });
    expect(p.animation).toBe('Say "hi"');
  });

  it('keeps an animation value that is no whole string literal as written', () => {
    const p = parseAnimatedSprite2D(heading('AnimatedSprite2D', { name: 'Anim' }), {
      animation: '&"unclosed\\"',
    });
    expect(p.animation).toBe('&"unclosed\\"');
  });

  it('defaults (centered true, frame 0, no animation)', () => {
    const p = parseAnimatedSprite2D(heading('AnimatedSprite2D', { name: 'Anim' }), {});
    expect(p.centered).toBe(true);
    expect(p.frame).toBe(0);
    expect(p.animation).toBeUndefined();
    expect(p.sprite_frames).toBeUndefined();
  });

  it('inherits Node2D transform (scale) + modulate', () => {
    const p = parseAnimatedSprite2D(heading('AnimatedSprite2D', { name: 'Anim' }), {
      scale: 'Vector2(0.5, 0.5)',
    });
    expect(p.scale).toEqual({ x: 0.5, y: 0.5 });
    expect(p.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});
