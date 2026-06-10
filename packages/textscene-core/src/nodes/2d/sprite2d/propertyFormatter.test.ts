/**
 * Tests for the Sprite2D property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatSprite2DProperties } from './propertyFormatter';
import { parseSprite2D } from './parser';
import type { Sprite2DProperties } from './types';

const heading = { type: 'node', attributes: { type: 'Sprite2D', name: 'Player' } };

function props(raw: Record<string, string> = {}): Sprite2DProperties {
  return parseSprite2D(heading, raw);
}

function section(sections: ReturnType<typeof formatSprite2DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatSprite2DProperties', () => {
  it('formats texture, centering, and offset with defaults', () => {
    const sections = formatSprite2DProperties(props());
    const texture = section(sections, 'Texture');
    expect(texture).toBeDefined();
    expect(texture!.items).toEqual([
      { label: 'Texture', value: '(none)' },
      { label: 'Centered', value: 'Yes' },
      { label: 'Offset', value: '(0, 0)' },
    ]);
  });

  it('shows texture reference, flips, and sprite-sheet section when set', () => {
    const sections = formatSprite2DProperties(
      props({
        texture: 'ExtResource("1_tex")',
        flip_h: 'true',
        hframes: '4',
        vframes: '2',
        frame: '3',
        frame_coords: 'Vector2i(3, 0)',
      })
    );
    const texture = section(sections, 'Texture')!;
    expect(texture.items).toContainEqual({ label: 'Texture', value: 'ExtResource("1_tex")' });
    expect(texture.items).toContainEqual({ label: 'Flip H', value: 'Yes' });
    expect(texture.items.some((i) => i.label === 'Flip V')).toBe(false);

    const sheet = section(sections, 'Sprite Sheet')!;
    expect(sheet.items).toEqual([
      { label: 'HFrames', value: '4' },
      { label: 'VFrames', value: '2' },
      { label: 'Frame', value: '3' },
      { label: 'Frame Coords', value: '(3, 0)' },
    ]);
  });

  it('omits the sprite-sheet section for a single-frame sprite', () => {
    const sections = formatSprite2DProperties(props());
    expect(section(sections, 'Sprite Sheet')).toBeUndefined();
  });

  it('shows the region section only when region_enabled with a rect', () => {
    const withRegion = formatSprite2DProperties(
      props({ region_enabled: 'true', region_rect: 'Rect2(0, 0, 32, 16)' })
    );
    expect(section(withRegion, 'Region')!.items).toEqual([
      { label: 'Enabled', value: 'true' },
      { label: 'Rect', value: '(0, 0, 32, 16)' },
    ]);

    const without = formatSprite2DProperties(props({ region_rect: 'Rect2(0, 0, 32, 16)' }));
    expect(section(without, 'Region')).toBeUndefined();
  });

  it('appends the Node2D transform sections', () => {
    const sections = formatSprite2DProperties(props({ position: 'Vector2(100, 50)' }));
    const position = section(sections, 'Position')!;
    expect(position.items).toEqual([
      { label: 'X', value: '100.0' },
      { label: 'Y', value: '50.0' },
    ]);
    expect(section(sections, 'Scale')).toBeDefined();
    expect(section(sections, 'Ordering')).toBeDefined();
  });
});
