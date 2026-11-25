import { describe, it, expect } from 'vitest';
import { formatCamera2DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

async function sections(properties: Record<string, string> = {}) {
  return sectionsOf(formatCamera2DProperties, 'Camera2D', properties);
}

describe('formatCamera2DProperties', () => {
  it('lists the Godot defaults', async () => {
    expect(sectionTitled(await sections(), 'Camera')!.items).toEqual([
      { label: 'Zoom', value: '(1, 1)' },
      { label: 'Offset', value: '(0, 0)' },
      { label: 'Anchor Mode', value: 'Drag Center' },
      { label: 'Enabled', value: 'Yes' },
    ]);
  });

  it('lists the zoom, offset, anchor mode and enabled state the file sets', async () => {
    const set = await sections({
      zoom: 'Vector2(2, 2)',
      offset: 'Vector2(10, -20)',
      anchor_mode: '0',
      enabled: 'false',
    });
    expect(sectionTitled(set, 'Camera')!.items).toEqual([
      { label: 'Zoom', value: '(2, 2)' },
      { label: 'Offset', value: '(10, -20)' },
      { label: 'Anchor Mode', value: 'Fixed Top-Left' },
      { label: 'Enabled', value: 'No' },
    ]);
  });

  it('labels an out-of-range anchor mode as Unknown', async () => {
    expect(sectionTitled(await sections({ anchor_mode: '7' }), 'Camera')!.items).toContainEqual({
      label: 'Anchor Mode',
      value: 'Unknown',
    });
  });

  it('appends the Node2D transform sections', async () => {
    const set = await sections({ position: 'Vector2(320, 180)' });
    expect(sectionTitled(set, 'Position')!.items).toEqual([
      { label: 'X', value: '320.0' },
      { label: 'Y', value: '180.0' },
    ]);
    expect(sectionTitled(set, 'Ordering')).toBeDefined();
  });
});
