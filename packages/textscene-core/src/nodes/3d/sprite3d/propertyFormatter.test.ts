/**
 * Tests for the Sprite3D property formatter. Mirrors the depth of
 * `sprite2d/propertyFormatter.test.ts` for the 3D billboard-sprite surface.
 */

import { describe, it, expect } from 'vitest';
import { formatSprite3DProperties } from './propertyFormatter';
import { parseSprite3D } from './parser';
import type { Sprite3DProperties } from './types';
import { heading } from '../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): Sprite3DProperties {
  return parseSprite3D(heading('Sprite3D', { name: 'Sprite' }), raw);
}

function section(sections: ReturnType<typeof formatSprite3DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatSprite3DProperties', () => {
  it('formats texture, pixel size, and billboard with defaults (billboard disabled)', () => {
    const sections = formatSprite3DProperties(props());
    const texture = section(sections, 'Texture')!;

    expect(texture.items).toEqual([
      { label: 'Texture', value: '(none)' },
      { label: 'Pixel Size', value: '0.0100' },
      { label: 'Billboard', value: 'Disabled' },
    ]);
  });

  it('shows the Axis item only when billboard is Y-Axis Only (FIXED_Y)', () => {
    const withoutAxis = section(formatSprite3DProperties(props()), 'Texture')!;
    expect(withoutAxis.items.some((i) => i.label === 'Axis')).toBe(false);

    const withAxis = section(
      formatSprite3DProperties(props({ billboard: '2', axis: '0' })),
      'Texture'
    )!;
    expect(withAxis.items).toContainEqual({ label: 'Billboard', value: 'Y-Axis Only' });
    expect(withAxis.items).toContainEqual({ label: 'Axis', value: 'X' });
  });

  it('reports every billboard mode name', () => {
    expect(section(formatSprite3DProperties(props({ billboard: '1' })), 'Texture')!.items).toContainEqual(
      { label: 'Billboard', value: 'Enabled' }
    );
    expect(section(formatSprite3DProperties(props({ billboard: '3' })), 'Texture')!.items).toContainEqual(
      { label: 'Billboard', value: 'Particles (Unsupported)' }
    );
  });

  it('shows the texture resource reference verbatim when set', () => {
    const texture = section(
      formatSprite3DProperties(props({ texture: 'ExtResource("1_tex")' })),
      'Texture'
    )!;
    expect(texture.items).toContainEqual({ label: 'Texture', value: 'ExtResource("1_tex")' });
  });

  it('omits the Sprite Sheet section for a single-frame sprite (default)', () => {
    expect(section(formatSprite3DProperties(props()), 'Sprite Sheet')).toBeUndefined();
  });

  it('shows the Sprite Sheet section with frame coords when hframes/vframes/frame are set', () => {
    const sheet = section(
      formatSprite3DProperties(
        props({ hframes: '4', vframes: '2', frame: '3', frame_coords: 'Vector2i(3, 0)' })
      ),
      'Sprite Sheet'
    )!;
    expect(sheet.items).toEqual([
      { label: 'HFrames', value: '4' },
      { label: 'VFrames', value: '2' },
      { label: 'Frame', value: '3' },
      { label: 'Frame Coords', value: '(3, 0)' },
    ]);
  });

  it('shows the Region section only when region_enabled with a rect', () => {
    const withRegion = section(
      formatSprite3DProperties(
        props({ region_enabled: 'true', region_rect: 'Rect2(0, 0, 32, 16)' })
      ),
      'Region'
    )!;
    expect(withRegion.items).toEqual([
      { label: 'Enabled', value: 'true' },
      { label: 'Rect', value: '(0, 0, 32, 16)' },
    ]);

    const withoutFlag = section(
      formatSprite3DProperties(props({ region_rect: 'Rect2(0, 0, 32, 16)' })),
      'Region'
    );
    expect(withoutFlag).toBeUndefined();
  });

  it('formats the Appearance section with modulate, transparency, alpha cut, offset, render priority', () => {
    const appearance = section(
      formatSprite3DProperties(
        props({
          modulate: 'Color(1, 0.5, 0, 0.8)',
          transparency: '0.25',
          alpha_cut: '1',
          offset: 'Vector2(2, -3)',
          render_priority: '5',
        })
      ),
      'Appearance'
    )!;
    expect(appearance.items).toEqual([
      { label: 'Modulate', value: 'rgba(255, 128, 0, 0.80)' },
      { label: 'Transparency', value: '0.25' },
      { label: 'Alpha Cut', value: 'Discard' },
      { label: 'Offset', value: '(2, -3)' },
      { label: 'Render Priority', value: '5' },
    ]);
  });

  it('reports every alpha-cut mode name', () => {
    const appearance = section(
      formatSprite3DProperties(props({ alpha_cut: '2' })),
      'Appearance'
    )!;
    expect(appearance.items).toContainEqual({ label: 'Alpha Cut', value: 'Opaque Prepass' });
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatSprite3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
