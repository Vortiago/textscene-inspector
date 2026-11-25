import { describe, it, expect } from 'vitest';
import { formatAudioStreamPlayerProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatAudioStreamPlayerProperties', () => {
  it('lists the Godot defaults of a node that sets nothing', async () => {
    const sections = await sectionsOf(formatAudioStreamPlayerProperties, 'AudioStreamPlayer');
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

  it('lists the stream path and the values the file sets', async () => {
    const sections = await sectionsOf(
      formatAudioStreamPlayerProperties,
      'AudioStreamPlayer',
      {
        stream: 'ExtResource("1_ogg")',
        volume_db: '-6.5',
        autoplay: 'true',
        bus: '"Music"',
        max_polyphony: '4',
      },
      { ext: { '1_ogg': 'AudioStream' } }
    );
    expect(valueOf(sections, 'Stream')).toBe('res://1_ogg');
    expect(valueOf(sections, 'Volume (dB)')).toBe('-6.50');
    expect(valueOf(sections, 'Autoplay')).toBe('true');
    expect(valueOf(sections, 'Bus')).toBe('Music');
    expect(valueOf(sections, 'Max Polyphony')).toBe('4');
  });

  it('notes that audio is not played in the preview', async () => {
    const sections = await sectionsOf(formatAudioStreamPlayerProperties, 'AudioStreamPlayer');
    expect(valueOf(sections, 'Status')).toBe('Audio is not played in preview');
  });
});
