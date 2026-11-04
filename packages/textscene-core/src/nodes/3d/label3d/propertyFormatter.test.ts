/** Label3D property formatter. */

import { describe, it, expect } from 'vitest';
import { formatLabel3DProperties } from './propertyFormatter';
import { parseLabel3D } from './parser';
import type { Label3DProperties } from './types';
import { heading } from '../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): Label3DProperties {
  return parseLabel3D(heading('Label3D', { name: 'Label' }), raw);
}

function section(sections: ReturnType<typeof formatLabel3DProperties>, title: string) {
  return sections.find((s) => s.title === title);
}

describe('formatLabel3DProperties', () => {
  it('shows "(empty)" placeholder text, pixel size, and billboard mode by default (disabled)', () => {
    // Label3D's billboard defaults to DISABLED (Component.parity.test.tsx).
    const text = section(formatLabel3DProperties(props()), 'Text')!;
    expect(text.items).toEqual([
      { label: 'Text', value: '(empty)' },
      { label: 'Pixel Size', value: '0.0050' },
      { label: 'Billboard', value: 'Disabled' },
    ]);
  });

  it('shows the layout properties in a Layout section, at Godot defaults when unset', () => {
    const layout = section(formatLabel3DProperties(props()), 'Layout')!;
    expect(layout.items).toEqual([
      { label: 'Horizontal Alignment', value: 'HORIZONTAL_ALIGNMENT_CENTER' },
      { label: 'Vertical Alignment', value: 'VERTICAL_ALIGNMENT_CENTER' },
      { label: 'Width', value: '500' },
      { label: 'Autowrap Mode', value: 'AUTOWRAP_OFF' },
      { label: 'Autowrap Trim Flags', value: '192' },
      { label: 'Justification Flags', value: '163' },
      { label: 'Uppercase', value: 'Off' },
      { label: 'Offset', value: '0, 0' },
    ]);
  });

  it('reports the authored layout', () => {
    const layout = section(
      formatLabel3DProperties(
        props({
          horizontal_alignment: '3',
          vertical_alignment: '2',
          width: '120',
          autowrap_mode: '3',
          uppercase: 'true',
          offset: 'Vector2(4, -6)',
        })
      ),
      'Layout'
    )!;
    expect(layout.items).toEqual([
      { label: 'Horizontal Alignment', value: 'HORIZONTAL_ALIGNMENT_FILL' },
      { label: 'Vertical Alignment', value: 'VERTICAL_ALIGNMENT_BOTTOM' },
      { label: 'Width', value: '120' },
      { label: 'Autowrap Mode', value: 'AUTOWRAP_WORD_SMART' },
      { label: 'Autowrap Trim Flags', value: '192' },
      { label: 'Justification Flags', value: '163' },
      { label: 'Uppercase', value: 'On' },
      { label: 'Offset', value: '4, -6' },
    ]);
  });

  it('shows the authored text verbatim (quotes stripped by the parser)', () => {
    const text = section(formatLabel3DProperties(props({ text: '"Hello world"' })), 'Text')!;
    expect(text.items).toContainEqual({ label: 'Text', value: 'Hello world' });
  });

  it('reports every billboard mode name', () => {
    expect(section(formatLabel3DProperties(props({ billboard: '0' })), 'Text')!.items).toContainEqual({
      label: 'Billboard',
      value: 'Disabled',
    });
    expect(section(formatLabel3DProperties(props({ billboard: '2' })), 'Text')!.items).toContainEqual({
      label: 'Billboard',
      value: 'Y-Axis Only',
    });
  });

  it('formats the Color section with the modulate as rgba', () => {
    const color = section(formatLabel3DProperties(props({ modulate: 'Color(1, 0.5, 0, 1)' })), 'Color')!;
    expect(color.items).toEqual([{ label: 'Modulate', value: 'rgba(255, 128, 0, 1.00)' }]);
  });

  it('omits the Outline section when outline_size is the Godot default (12 > 0 — always shown)', () => {
    // Godot's default outline_size is 12, so the Outline section is present
    // even with no explicit override.
    const sections = formatLabel3DProperties(props());
    expect(section(sections, 'Outline')).toBeDefined();
  });

  it('omits the Outline section only when outline_size is explicitly zero', () => {
    const sections = formatLabel3DProperties(props({ outline_size: '0' }));
    expect(section(sections, 'Outline')).toBeUndefined();
  });

  it('formats the Outline section with size and color when outline_size > 0', () => {
    const outline = section(
      formatLabel3DProperties(props({ outline_size: '8', outline_modulate: 'Color(0, 0, 0, 1)' })),
      'Outline'
    )!;
    expect(outline.items).toEqual([
      { label: 'Outline Size', value: '8' },
      { label: 'Outline Color', value: 'rgba(0, 0, 0, 1.00)' },
    ]);
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatLabel3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
