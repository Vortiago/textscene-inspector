/**
 * Tests for the AnimatedSprite2D property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatAnimatedSprite2DProperties } from './propertyFormatter';
import { parseAnimatedSprite2D } from './parser';
import type { AnimatedSprite2DProperties } from './types';

const heading = { type: 'node', attributes: { type: 'AnimatedSprite2D', name: 'Walker' } };

function props(raw: Record<string, string> = {}): AnimatedSprite2DProperties {
  return parseAnimatedSprite2D(heading, raw);
}

function section(sections: ReturnType<typeof formatAnimatedSprite2DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatAnimatedSprite2DProperties', () => {
  it('formats the animation section with defaults', () => {
    const sections = formatAnimatedSprite2DProperties(props());
    expect(section(sections, 'Animation')!.items).toEqual([
      { label: 'Sprite Frames', value: '(none)' },
      { label: 'Animation', value: 'default' },
      { label: 'Frame', value: '0' },
    ]);
  });

  it('shows the SpriteFrames reference, animation name, and frame index', () => {
    const sections = formatAnimatedSprite2DProperties(
      props({ sprite_frames: 'SubResource("1_frames")', animation: '&"run"', frame: '2' })
    );
    expect(section(sections, 'Animation')!.items).toEqual([
      { label: 'Sprite Frames', value: 'SubResource("1_frames")' },
      { label: 'Animation', value: 'run' },
      { label: 'Frame', value: '2' },
    ]);
  });

  it('formats appearance with conditional flips', () => {
    const sections = formatAnimatedSprite2DProperties(
      props({ centered: 'false', offset: 'Vector2(4, -8)', flip_v: 'true' })
    );
    const appearance = section(sections, 'Appearance')!;
    expect(appearance.items).toEqual([
      { label: 'Centered', value: 'No' },
      { label: 'Offset', value: '(4, -8)' },
      { label: 'Flip V', value: 'Yes' },
    ]);
  });

  it('appends the Node2D transform sections', () => {
    const sections = formatAnimatedSprite2DProperties(props({ position: 'Vector2(8, 16)' }));
    expect(section(sections, 'Position')!.items).toEqual([
      { label: 'X', value: '8.0' },
      { label: 'Y', value: '16.0' },
    ]);
    expect(section(sections, 'Rotation (degrees)')).toBeDefined();
    expect(section(sections, 'CanvasItem')).toBeDefined();
  });
});
