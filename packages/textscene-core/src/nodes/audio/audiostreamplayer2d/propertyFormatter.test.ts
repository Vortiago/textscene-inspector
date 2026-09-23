/**
 * AudioStreamPlayer2D property formatter, where it differs from the 3D sibling: max_distance is a
 * finite pixel distance (default 2000), never the 3D-only "Unlimited", and playback_type labels
 * follow Godot's AudioServer.PlaybackType (0=Default, 1=Stream, 2=Sample).
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import type { PropertySection } from '../../../core/NodeRegistry';
import { parseAudioStreamPlayer2D } from './parser';
import { formatAudioStreamPlayer2DProperties } from './propertyFormatter';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Audio', type: 'AudioStreamPlayer2D' },
};

function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

describe('formatAudioStreamPlayer2DProperties', () => {
  it('renders the Godot defaults (happy path)', () => {
    const sections = formatAudioStreamPlayer2DProperties(parseAudioStreamPlayer2D(HEADING, {}));
    expect(valueOf(sections, 'Stream')).toBe('(none)');
    expect(valueOf(sections, 'Bus')).toBe('Master');
    expect(valueOf(sections, 'Autoplay')).toBe('false');
    expect(valueOf(sections, 'Volume (dB)')).toBe('0.00');
    // 2D default max_distance is 2000 (a finite pixel distance), not 3D's 0/"Unlimited".
    expect(valueOf(sections, 'Max Distance')).toBe('2000.00');
    expect(valueOf(sections, 'Playback Type')).toBe('Default');
  });

  it('labels playback_type per Godot AudioServer.PlaybackType', () => {
    const stream = parseAudioStreamPlayer2D(HEADING, { playback_type: '1' });
    const sample = parseAudioStreamPlayer2D(HEADING, { playback_type: '2' });
    expect(valueOf(formatAudioStreamPlayer2DProperties(stream), 'Playback Type')).toBe('Stream');
    expect(valueOf(formatAudioStreamPlayer2DProperties(sample), 'Playback Type')).toBe('Sample');
  });

  it('never renders max_distance as "Unlimited" (a 3D-only concept), even for 0', () => {
    // 0 is invalid for 2D (linter rejects it), but the formatter must still show a
    // finite number rather than the 3D "Unlimited" label.
    const sections = formatAudioStreamPlayer2DProperties(
      parseAudioStreamPlayer2D(HEADING, { max_distance: '0' })
    );
    expect(valueOf(sections, 'Max Distance')).toBe('0.00');
  });

  it('reflects explicit spatial + stream values', () => {
    const sections = formatAudioStreamPlayer2DProperties(
      parseAudioStreamPlayer2D(HEADING, {
        stream: 'ExtResource("1_ogg")',
        max_distance: '500',
        autoplay: 'true',
        bus: '&"SFX"',
      })
    );
    expect(valueOf(sections, 'Stream')).toBe('ExtResource("1_ogg")');
    expect(valueOf(sections, 'Max Distance')).toBe('500.00');
    expect(valueOf(sections, 'Autoplay')).toBe('true');
    expect(valueOf(sections, 'Bus')).toBe('SFX');
  });
});
