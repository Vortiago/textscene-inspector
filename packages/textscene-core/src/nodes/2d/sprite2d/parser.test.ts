import { describe, it, expect } from 'vitest';
import { parseSprite2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseSprite2D', () => {
  it('parses texture, flags, offset, and sprite-sheet frames', () => {
    const p = parseSprite2D(heading('Sprite2D', { name: 'S' }), {
      texture: 'ExtResource("1_t")',
      centered: 'false',
      offset: 'Vector2(5, -3)',
      flip_h: 'true',
      hframes: '4',
      vframes: '2',
      frame: '3',
    });
    expect(p.texture).toBe('ExtResource("1_t")');
    expect(p.centered).toBe(false);
    expect(p.offset).toEqual({ x: 5, y: -3 });
    expect(p.flip_h).toBe(true);
    expect(p.flip_v).toBe(false);
    expect(p.hframes).toBe(4);
    expect(p.vframes).toBe(2);
    expect(p.frame).toBe(3);
  });

  it('applies Godot defaults (centered true, frames 1, modulate white opaque)', () => {
    const p = parseSprite2D(heading('Sprite2D', { name: 'S' }), {});
    expect(p.centered).toBe(true);
    expect(p.hframes).toBe(1);
    expect(p.vframes).toBe(1);
    expect(p.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(p.texture).toBeUndefined();
  });

  it('inherits the Node2D transform', () => {
    const p = parseSprite2D(heading('Sprite2D', { name: 'S' }), {
      position: 'Vector2(10, 20)',
      z_index: '2',
    });
    expect(p.position).toEqual({ x: 10, y: 20 });
    expect(p.z_index).toBe(2);
  });

  it('parses region_enabled + region_rect', () => {
    const p = parseSprite2D(heading('Sprite2D', { name: 'S' }), {
      region_enabled: 'true',
      region_rect: 'Rect2(0, 0, 16, 24)',
    });
    expect(p.region_enabled).toBe(true);
    expect(p.region_rect).toEqual({ x: 0, y: 0, width: 16, height: 24 });
  });

  it('refuses a malformed region_rect instead of storing NaN or truncated components', () => {
    // The retired loose grammar matched `1.2.3` (truncating to 1.2) and `--1`
    // (landing as NaN) — a NaN region is an invisible sprite.
    for (const bad of ['Rect2(--1, 0, 8, 8)', 'Rect2(1.2.3, 0, 8, 8)', 'Rect2(1e-, 0, 8, 8)']) {
      const p = parseSprite2D(heading('Sprite2D', { name: 'S' }), {
        region_enabled: 'true',
        region_rect: bad,
      });
      expect(p.region_rect).toBeUndefined();
    }
  });

  it('parses a modulate Color tint', () => {
    const p = parseSprite2D(heading('Sprite2D', { name: 'S' }), {
      modulate: 'Color(1, 0, 0, 0.5)',
    });
    expect(p.modulate.r).toBeCloseTo(1);
    expect(p.modulate.g).toBeCloseTo(0);
    expect(p.modulate.a).toBeCloseTo(0.5);
  });
});
