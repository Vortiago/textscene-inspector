/**
 * AudioStreamPlayer property-formatter tests — the non-spatial player surfaces
 * the Stream + Mixing sections in the details panel.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import type { PropertySection } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer } from './parser';
import { formatAudioStreamPlayerProperties } from './propertyFormatter';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Audio', type: 'AudioStreamPlayer' },
};

function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

describe('formatAudioStreamPlayerProperties', () => {
  it('renders the Godot defaults (happy path)', () => {
    const sections = formatAudioStreamPlayerProperties(parseAudioStreamPlayer(HEADING, {}));
    expect(sections.map((s) => s.title)).toContain('Stream');
    expect(sections.map((s) => s.title)).toContain('Mixing');
    expect(valueOf(sections, 'Stream')).toBe('(none)');
    expect(valueOf(sections, 'Bus')).toBe('Master');
    expect(valueOf(sections, 'Autoplay')).toBe('false');
    expect(valueOf(sections, 'Playing')).toBe('false');
    expect(valueOf(sections, 'Volume (dB)')).toBe('0.00');
    expect(valueOf(sections, 'Pitch Scale')).toBe('1.000');
    expect(valueOf(sections, 'Max Polyphony')).toBe('1');
  });

  it('reflects explicit values', () => {
    const sections = formatAudioStreamPlayerProperties(
      parseAudioStreamPlayer(HEADING, {
        stream: 'ExtResource("1_ogg")',
        volume_db: '-6.5',
        autoplay: 'true',
        bus: '"Music"',
        max_polyphony: '4',
      })
    );
    expect(valueOf(sections, 'Stream')).toBe('ExtResource("1_ogg")');
    expect(valueOf(sections, 'Volume (dB)')).toBe('-6.50');
    expect(valueOf(sections, 'Autoplay')).toBe('true');
    expect(valueOf(sections, 'Bus')).toBe('Music');
    expect(valueOf(sections, 'Max Polyphony')).toBe('4');
  });

  it('notes that audio is not played in the preview', () => {
    const sections = formatAudioStreamPlayerProperties(parseAudioStreamPlayer(HEADING, {}));
    expect(valueOf(sections, 'Status')).toBe('Audio is not played in preview');
  });
});
