/**
 * Tests for the Camera2D property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatCamera2DProperties } from './propertyFormatter';
import { parseCamera2D } from './parser';
import type { Camera2DProperties } from './types';

const heading = { type: 'node', attributes: { type: 'Camera2D', name: 'Cam' } };

function props(raw: Record<string, string> = {}): Camera2DProperties {
  return parseCamera2D(heading, raw);
}

function section(sections: ReturnType<typeof formatCamera2DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatCamera2DProperties', () => {
  it('formats the camera section with Godot defaults', () => {
    const sections = formatCamera2DProperties(props());
    expect(section(sections, 'Camera')!.items).toEqual([
      { label: 'Zoom', value: '(1, 1)' },
      { label: 'Offset', value: '(0, 0)' },
      { label: 'Anchor Mode', value: 'Drag Center' },
      { label: 'Enabled', value: 'Yes' },
    ]);
  });

  it('formats explicit zoom, offset, anchor mode, and disabled state', () => {
    const sections = formatCamera2DProperties(
      props({
        zoom: 'Vector2(2, 2)',
        offset: 'Vector2(10, -20)',
        anchor_mode: '0',
        enabled: 'false',
      })
    );
    expect(section(sections, 'Camera')!.items).toEqual([
      { label: 'Zoom', value: '(2, 2)' },
      { label: 'Offset', value: '(10, -20)' },
      { label: 'Anchor Mode', value: 'Fixed Top-Left' },
      { label: 'Enabled', value: 'No' },
    ]);
  });

  it('labels an out-of-range anchor mode as Unknown', () => {
    const sections = formatCamera2DProperties(props({ anchor_mode: '7' }));
    expect(section(sections, 'Camera')!.items).toContainEqual({
      label: 'Anchor Mode',
      value: 'Unknown',
    });
  });

  it('appends the Node2D transform sections', () => {
    const sections = formatCamera2DProperties(props({ position: 'Vector2(320, 180)' }));
    expect(section(sections, 'Position')!.items).toEqual([
      { label: 'X', value: '320.0' },
      { label: 'Y', value: '180.0' },
    ]);
    expect(section(sections, 'Ordering')).toBeDefined();
  });
});
