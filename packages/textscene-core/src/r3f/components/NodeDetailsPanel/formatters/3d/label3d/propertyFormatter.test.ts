import { describe, it, expect } from 'vitest';
import { formatLabel3DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionTitled(await sectionsOf(formatLabel3DProperties, 'Label3D', properties), title);
}

describe('formatLabel3DProperties', () => {
  it('lists an empty text, the pixel size and a disabled billboard for a node that sets nothing', async () => {
    const text = (await section('Text'))!;
    expect(text.items).toEqual([
      { label: 'Text', value: '(empty)' },
      { label: 'Pixel Size', value: '0.0050' },
      { label: 'Billboard', value: 'Disabled' },
      { label: 'Shaded', value: 'Off' },
    ]);
  });

  it('shows an authored shaded flag', async () => {
    const text = (await section('Text', { shaded: 'true' }))!;
    expect(text.items).toContainEqual({ label: 'Shaded', value: 'On' });
  });

  it('shows the layout properties in a Layout section, at Godot defaults when unset', async () => {
    const layout = (await section('Layout'))!;
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

  it('reports the authored layout', async () => {
    const layout = (await section('Layout', {
      horizontal_alignment: '3',
      vertical_alignment: '2',
      width: '120',
      autowrap_mode: '3',
      uppercase: 'true',
      offset: 'Vector2(4, -6)',
    }))!;
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

  it('shows the authored text verbatim the file sets', async () => {
    const text = (await section('Text', { text: '"Hello world"' }))!;
    expect(text.items).toContainEqual({ label: 'Text', value: 'Hello world' });
  });

  it('reports every billboard mode name', async () => {
    expect((await section('Text', { billboard: '0' }))!.items).toContainEqual({
      label: 'Billboard',
      value: 'Disabled',
    });
    expect((await section('Text', { billboard: '2' }))!.items).toContainEqual({
      label: 'Billboard',
      value: 'Y-Axis Only',
    });
  });

  it('formats the Color section with the modulate as rgba', async () => {
    const color = (await section('Color', { modulate: 'Color(1, 0.5, 0, 1)' }))!;
    expect(color.items).toEqual([{ label: 'Modulate', value: 'rgba(255, 128, 0, 1.00)' }]);
  });

  it("lists the Outline section at Godot's default outline_size of 12", async () => {
    expect(await section('Outline')).toBeDefined();
  });

  it('omits the Outline section only when outline_size is explicitly zero', async () => {
    expect(await section('Outline', { outline_size: '0' })).toBeUndefined();
  });

  it('formats the Outline section with size and color when outline_size > 0', async () => {
    const outline = (await section('Outline', { outline_size: '8', outline_modulate: 'Color(0, 0, 0, 1)' }))!;
    expect(outline.items).toEqual([
      { label: 'Outline Size', value: '8' },
      { label: 'Outline Color', value: 'rgba(0, 0, 0, 1.00)' },
    ]);
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
