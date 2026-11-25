import { describe, it, expect } from 'vitest';
import { formatAudioStreamPlayer2DProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../testing/inspectedScene';

function sections(properties: Record<string, string> = {}) {
  return sectionsOf(formatAudioStreamPlayer2DProperties, 'AudioStreamPlayer2D', properties, {
    ext: { '1_ogg': 'AudioStream' },
  });
}

describe('formatAudioStreamPlayer2DProperties', () => {
  it('lists the Godot defaults of a node that sets nothing', async () => {
    const defaults = await sections();
    expect(valueOf(defaults, 'Stream')).toBe('(none)');
    expect(valueOf(defaults, 'Bus')).toBe('Master');
    expect(valueOf(defaults, 'Autoplay')).toBe('false');
    expect(valueOf(defaults, 'Volume (dB)')).toBe('0.00');
    expect(valueOf(defaults, 'Max Distance')).toBe('2000.00');
    expect(valueOf(defaults, 'Playback Type')).toBe('Default');
  });

  it("labels playback_type with Godot's AudioServer.PlaybackType names", async () => {
    expect(valueOf(await sections({ playback_type: '1' }), 'Playback Type')).toBe('Stream');
    expect(valueOf(await sections({ playback_type: '2' }), 'Playback Type')).toBe('Sample');
  });

  it('lists the stream path and the spatial values the file sets', async () => {
    const set = await sections({
      stream: 'ExtResource("1_ogg")',
      max_distance: '500',
      autoplay: 'true',
      bus: '&"SFX"',
    });
    expect(valueOf(set, 'Stream')).toBe('res://1_ogg');
    expect(valueOf(set, 'Max Distance')).toBe('500.00');
    expect(valueOf(set, 'Autoplay')).toBe('true');
    expect(valueOf(set, 'Bus')).toBe('SFX');
  });
});
