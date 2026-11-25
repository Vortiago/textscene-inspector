import { describe, it, expect } from 'vitest';
import { formatAudioStreamPlayer3DProperties } from './propertyFormatter';
import { sectionIn } from '../../testing/inspectedScene';

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionIn(formatAudioStreamPlayer3DProperties, 'AudioStreamPlayer3D', title, properties, {
    ext: { '1_snd': 'AudioStream' },
  });
}

describe('formatAudioStreamPlayer3DProperties', () => {
  it('lists the shared Stream section with defaults and the not-played-in-preview status', async () => {
    const stream = (await section('Stream'))!;
    expect(stream.items).toEqual([
      { label: 'Stream', value: '(none)' },
      { label: 'Bus', value: 'Master' },
      { label: 'Autoplay', value: 'false' },
      { label: 'Playing', value: 'false' },
      { label: 'Status', value: 'Audio is not played in preview' },
    ]);
  });

  it('lists the stream path and the autoplay flag the file sets, and no playback of a stream that fails to load', async () => {
    const stream = (await section('Stream', {
      stream: 'ExtResource("1_snd")',
      autoplay: 'true',
      playing: 'true',
    }))!;
    expect(stream.items).toContainEqual({ label: 'Stream', value: 'res://1_snd' });
    expect(stream.items).toContainEqual({ label: 'Autoplay', value: 'true' });
    expect(stream.items).toContainEqual({ label: 'Playing', value: 'false' });
  });

  it('lists the Mixing section with defaults', async () => {
    const mixing = (await section('Mixing'))!;
    expect(mixing.items).toEqual([
      { label: 'Volume (dB)', value: '0.00' },
      { label: 'Pitch Scale', value: '1.000' },
      { label: 'Max Volume (dB)', value: '3.00' },
      { label: 'Panning Strength', value: '1.00' },
      { label: 'Max Polyphony', value: '1' },
    ]);
  });

  it('lists the Attenuation section, mapping every attenuation model name', async () => {
    const attenuation = (await section('Attenuation'))!;
    expect(attenuation.items).toEqual([
      { label: 'Model', value: 'Inverse Distance' },
      { label: 'Unit Size', value: '10.00' },
      { label: 'Max Distance', value: 'Unlimited' },
      { label: 'Filter Cutoff (Hz)', value: '5000' },
      { label: 'Filter Strength (dB)', value: '-24.00' },
    ]);

    expect((await section('Attenuation', { attenuation_model: '1' }))!.items).toContainEqual({
      label: 'Model',
      value: 'Inverse Square',
    });
    expect((await section('Attenuation', { attenuation_model: '2' }))!.items).toContainEqual({
      label: 'Model',
      value: 'Logarithmic',
    });
    expect((await section('Attenuation', { attenuation_model: '3' }))!.items).toContainEqual({
      label: 'Model',
      value: 'Disabled',
    });
  });

  it('lists a finite Max Distance value (not "Unlimited") when non-zero', async () => {
    const attenuation = (await section('Attenuation', { max_distance: '25' }))!;
    expect(attenuation.items).toContainEqual({ label: 'Max Distance', value: '25.00' });
  });

  it('lists no Emission Cone section when emission_angle_enabled is false (default)', async () => {
    expect(await section('Emission Cone')).toBeUndefined();
  });

  it('lists the Emission Cone section when emission_angle_enabled is true', async () => {
    const cone = (await section('Emission Cone', {
      emission_angle_enabled: 'true',
      emission_angle_degrees: '30',
      emission_angle_filter_attenuation_db: '-6',
    }))!;
    expect(cone.items).toEqual([
      { label: 'Enabled', value: 'true' },
      { label: 'Half-angle (°)', value: '30.0' },
      { label: 'Outside Attenuation (dB)', value: '-6.00' },
    ]);
  });

  it('lists the Spatial section, mapping every Doppler tracking mode and the area mask in hex', async () => {
    const spatial = (await section('Spatial', { area_mask: '255' }))!;
    expect(spatial.items).toEqual([
      { label: 'Doppler Tracking', value: 'Disabled' },
      { label: 'Area Mask', value: '0xff' },
    ]);

    expect((await section('Spatial', { doppler_tracking: '1' }))!.items).toContainEqual({
      label: 'Doppler Tracking',
      value: 'Idle Step',
    });
    expect((await section('Spatial', { doppler_tracking: '2' }))!.items).toContainEqual({
      label: 'Doppler Tracking',
      value: 'Physics Step',
    });
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
