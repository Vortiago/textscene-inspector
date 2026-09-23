/**
 * Environment ambient and fog against Godot 4.x. `ambient_light_color` defaults to
 * black. DISABLED(1) emits no flat ambient, COLOR(2) and SKY(3) the flat colour, and
 * the default BG(0) the background colour. `fog_enabled` drives scene fog, not `volumetric_fog`.
 */
import { describe, it, expect } from 'vitest';
import { decodeEnvironment } from './decode';
import { createEnvironmentSettings } from './build';

describe('Environment Godot parity', () => {
  it('ambient_light_color defaults to black (not white)', () => {
    expect(decodeEnvironment({}).ambient_light_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses ambient_light_source (default 0 = BG)', () => {
    expect(decodeEnvironment({}).ambient_light_source).toBe(0);
    expect(decodeEnvironment({ ambient_light_source: '2' }).ambient_light_source).toBe(2);
  });

  it('emits none for DISABLED; emits for BG (from the background) and COLOR', () => {
    // BG(0) is the default source AND CLEAR_COLOR(0) the default mode, so a
    // bare Environment lights the scene with Godot's default clear colour.
    expect(createEnvironmentSettings(decodeEnvironment({})).ambient).toEqual({
      color: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
      energy: 1,
    });
    expect(createEnvironmentSettings(decodeEnvironment({ ambient_light_source: '1' })).ambient).toBeNull(); // DISABLED
    const colored = createEnvironmentSettings(
      decodeEnvironment({ ambient_light_source: '2', ambient_light_color: 'Color(0.2, 0.2, 0.2, 1)' })
    );
    expect(colored.ambient).not.toBeNull();
  });

  it('parses screen-space fog (fog_enabled / fog_density / fog_mode)', () => {
    const p = decodeEnvironment({ fog_enabled: 'true', fog_density: '0.02', fog_mode: '1' });
    expect(p.fog_enabled).toBe(true);
    expect(p.fog_density).toBeCloseTo(0.02, 5);
    expect(p.fog_mode).toBe(1);
  });

  it('drives scene fog from screen-space fog_enabled, not volumetric_fog', () => {
    const screen = createEnvironmentSettings(decodeEnvironment({ fog_enabled: 'true', fog_density: '0.01' }));
    expect(screen.fog).not.toBeNull();
    expect(screen.fog?.density).toBeCloseTo(0.01, 5);

    // Volumetric fog alone must not drive scene fog: it has no three.js equivalent.
    const volOnly = createEnvironmentSettings(
      decodeEnvironment({ volumetric_fog_enabled: 'true', volumetric_fog_density: '0.05' })
    );
    expect(volOnly.fog).toBeNull();
  });
});
