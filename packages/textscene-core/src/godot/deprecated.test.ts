/**
 * The pre-4.0 property names Godot's `_set` overrides still accept.
 *
 * Table-only: the resolver has no behaviour beyond the lookup, so what is worth
 * pinning is that each entry names the property the setter actually writes.
 */

import { describe, expect, it } from 'vitest';
import { canonicalPropertyName, isDeprecatedPropertyName } from './deprecated.js';

describe('canonicalPropertyName', () => {
  it('maps `frames` to the sprite_frames setter, both dimensions', () => {
    expect(canonicalPropertyName('AnimatedSprite2D', 'frames')).toBe('sprite_frames');
    expect(canonicalPropertyName('AnimatedSprite3D', 'frames')).toBe('sprite_frames');
  });

  it("maps Label's align pair to the alignment setters", () => {
    expect(canonicalPropertyName('Label', 'align')).toBe('horizontal_alignment');
    expect(canonicalPropertyName('Label', 'valign')).toBe('vertical_alignment');
  });

  it('leaves a current name alone', () => {
    expect(canonicalPropertyName('AnimatedSprite2D', 'sprite_frames')).toBe('sprite_frames');
    expect(canonicalPropertyName('Sprite2D', 'texture')).toBe('texture');
  });

  it('does not apply one type’s alias to another', () => {
    // `_set` is a virtual on the declaring class, so `Label.align` says nothing
    // about any other Control — and `frames` is a real, current property name
    // on SpriteFrames-adjacent types that do not alias it.
    expect(canonicalPropertyName('Button', 'align')).toBe('align');
    expect(canonicalPropertyName('Sprite2D', 'frames')).toBe('frames');
  });

  it('reports which spellings are deprecated', () => {
    expect(isDeprecatedPropertyName('Label', 'align')).toBe(true);
    expect(isDeprecatedPropertyName('Label', 'horizontal_alignment')).toBe(false);
  });
});
