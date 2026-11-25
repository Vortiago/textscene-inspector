import { describe, it, expect } from 'vitest';
import { formatSprite2DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

function sections(properties: Record<string, string> = {}) {
  return sectionsOf(formatSprite2DProperties, 'Sprite2D', properties, { ext: { '1_tex': 'Texture2D' } });
}

describe('formatSprite2DProperties', () => {
  it('lists the texture, the centring and the offset of a node that sets nothing', async () => {
    expect(sectionTitled(await sections(), 'Texture')!.items).toEqual([
      { label: 'Texture', value: '(none)' },
      { label: 'Centered', value: 'Yes' },
      { label: 'Offset', value: '(0, 0)' },
    ]);
  });

  it('lists the texture path, the flips that are on and the sprite sheet', async () => {
    const set = await sections({
      texture: 'ExtResource("1_tex")',
      flip_h: 'true',
      hframes: '4',
      vframes: '2',
      frame: '3',
      frame_coords: 'Vector2i(3, 0)',
    });
    const texture = sectionTitled(set, 'Texture')!;
    expect(texture.items).toContainEqual({ label: 'Texture', value: 'res://1_tex' });
    expect(texture.items).toContainEqual({ label: 'Flip H', value: 'Yes' });
    expect(texture.items.some((i) => i.label === 'Flip V')).toBe(false);

    expect(sectionTitled(set, 'Sprite Sheet')!.items).toEqual([
      { label: 'HFrames', value: '4' },
      { label: 'VFrames', value: '2' },
      { label: 'Frame', value: '3' },
      { label: 'Frame Coords', value: '(3, 0)' },
    ]);
  });

  it('lists no sprite-sheet section for a single-frame sprite', async () => {
    expect(sectionTitled(await sections(), 'Sprite Sheet')).toBeUndefined();
  });

  it('lists the region section only when region_enabled is on', async () => {
    const withRegion = await sections({ region_enabled: 'true', region_rect: 'Rect2(0, 0, 32, 16)' });
    expect(sectionTitled(withRegion, 'Region')!.items).toEqual([
      { label: 'Enabled', value: 'true' },
      { label: 'Rect', value: '(0, 0, 32, 16)' },
    ]);

    const without = await sections({ region_rect: 'Rect2(0, 0, 32, 16)' });
    expect(sectionTitled(without, 'Region')).toBeUndefined();
  });

  it('appends the Node2D transform sections', async () => {
    const set = await sections({ position: 'Vector2(100, 50)' });
    expect(sectionTitled(set, 'Position')!.items).toEqual([
      { label: 'X', value: '100.0' },
      { label: 'Y', value: '50.0' },
    ]);
    expect(sectionTitled(set, 'Scale')).toBeDefined();
    expect(sectionTitled(set, 'Ordering')).toBeDefined();
  });
});
