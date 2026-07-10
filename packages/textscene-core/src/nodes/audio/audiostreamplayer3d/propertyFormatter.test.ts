/**
 * Tests for the AudioStreamPlayer3D property formatter.
 */

import { describe, it, expect } from 'vitest';
import { formatAudioStreamPlayer3DProperties } from './propertyFormatter';
import { parseAudioStreamPlayer3D } from './parser';
import type { AudioStreamPlayer3DProperties } from './types';
import { heading } from '../../../parser/testing/parserKit';

function props(raw: Record<string, string> = {}): AudioStreamPlayer3DProperties {
  return parseAudioStreamPlayer3D(heading('AudioStreamPlayer3D', { name: 'Sound' }), raw);
}

function section(
  sections: ReturnType<typeof formatAudioStreamPlayer3DProperties>,
  title: string
) {
  return sections.find((s) => s.title === title);
}

describe('formatAudioStreamPlayer3DProperties', () => {
  it('formats the shared Stream section with defaults and the not-played-in-preview status', () => {
    const stream = section(formatAudioStreamPlayer3DProperties(props()), 'Stream')!;
    expect(stream.items).toEqual([
      { label: 'Stream', value: '(none)' },
      { label: 'Bus', value: 'Master' },
      { label: 'Autoplay', value: 'false' },
      { label: 'Playing', value: 'false' },
      { label: 'Status', value: 'Audio is not played in preview' },
    ]);
  });

  it('shows the stream reference and autoplay/playing flags when set', () => {
    const stream = section(
      formatAudioStreamPlayer3DProperties(
        props({ stream: 'ExtResource("1_snd")', autoplay: 'true', playing: 'true' })
      ),
      'Stream'
    )!;
    expect(stream.items).toContainEqual({ label: 'Stream', value: 'ExtResource("1_snd")' });
    expect(stream.items).toContainEqual({ label: 'Autoplay', value: 'true' });
    expect(stream.items).toContainEqual({ label: 'Playing', value: 'true' });
  });

  it('formats the Mixing section with defaults', () => {
    const mixing = section(formatAudioStreamPlayer3DProperties(props()), 'Mixing')!;
    expect(mixing.items).toEqual([
      { label: 'Volume (dB)', value: '0.00' },
      { label: 'Pitch Scale', value: '1.000' },
      { label: 'Max Volume (dB)', value: '3.00' },
      { label: 'Panning Strength', value: '1.00' },
      { label: 'Max Polyphony', value: '1' },
    ]);
  });

  it('formats the Attenuation section, mapping every attenuation model name', () => {
    const attenuation = section(formatAudioStreamPlayer3DProperties(props()), 'Attenuation')!;
    expect(attenuation.items).toEqual([
      { label: 'Model', value: 'Inverse Distance' },
      { label: 'Unit Size', value: '10.00' },
      { label: 'Max Distance', value: 'Unlimited' },
      { label: 'Filter Cutoff (Hz)', value: '5000' },
      { label: 'Filter Strength (dB)', value: '-24.00' },
    ]);

    expect(
      section(
        formatAudioStreamPlayer3DProperties(props({ attenuation_model: '1' })),
        'Attenuation'
      )!.items
    ).toContainEqual({ label: 'Model', value: 'Inverse Square' });
    expect(
      section(
        formatAudioStreamPlayer3DProperties(props({ attenuation_model: '2' })),
        'Attenuation'
      )!.items
    ).toContainEqual({ label: 'Model', value: 'Logarithmic' });
    expect(
      section(
        formatAudioStreamPlayer3DProperties(props({ attenuation_model: '3' })),
        'Attenuation'
      )!.items
    ).toContainEqual({ label: 'Model', value: 'Disabled' });
  });

  it('shows a finite Max Distance value (not "Unlimited") when non-zero', () => {
    const attenuation = section(
      formatAudioStreamPlayer3DProperties(props({ max_distance: '25' })),
      'Attenuation'
    )!;
    expect(attenuation.items).toContainEqual({ label: 'Max Distance', value: '25.00' });
  });

  it('omits the Emission Cone section when emission_angle_enabled is false (default)', () => {
    const sections = formatAudioStreamPlayer3DProperties(props());
    expect(section(sections, 'Emission Cone')).toBeUndefined();
  });

  it('formats the Emission Cone section when emission_angle_enabled is true', () => {
    const cone = section(
      formatAudioStreamPlayer3DProperties(
        props({
          emission_angle_enabled: 'true',
          emission_angle_degrees: '30',
          emission_angle_filter_attenuation_db: '-6',
        })
      ),
      'Emission Cone'
    )!;
    expect(cone.items).toEqual([
      { label: 'Enabled', value: 'true' },
      { label: 'Half-angle (°)', value: '30.0' },
      { label: 'Outside Attenuation (dB)', value: '-6.00' },
    ]);
  });

  it('formats the Spatial section, mapping every Doppler tracking mode and the area mask in hex', () => {
    const spatial = section(
      formatAudioStreamPlayer3DProperties(props({ area_mask: '255' })),
      'Spatial'
    )!;
    expect(spatial.items).toEqual([
      { label: 'Doppler Tracking', value: 'Disabled' },
      { label: 'Area Mask', value: '0xff' },
    ]);

    expect(
      section(
        formatAudioStreamPlayer3DProperties(props({ doppler_tracking: '1' })),
        'Spatial'
      )!.items
    ).toContainEqual({ label: 'Doppler Tracking', value: 'Idle Step' });
    expect(
      section(
        formatAudioStreamPlayer3DProperties(props({ doppler_tracking: '2' })),
        'Spatial'
      )!.items
    ).toContainEqual({ label: 'Doppler Tracking', value: 'Physics Step' });
  });

  it('appends the Node3D transform sections', () => {
    const sections = formatAudioStreamPlayer3DProperties(
      props({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)' })
    );
    expect(section(sections, 'Position')).toBeDefined();
    expect(section(sections, 'Scale')).toBeDefined();
  });
});
