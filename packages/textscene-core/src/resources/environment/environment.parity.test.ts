/**
 * Parity: Environment ambient + fog vs Godot 4.x.
 * - ambient_light_color default is BLACK (no ambient), not white.
 * - ambient_light_source gates flat ambient: BG(0)/DISABLED(1) emit none;
 *   COLOR(2)/SKY(3) emit the flat colour.
 * - scene fog is driven by Godot's SCREEN-SPACE fog (fog_enabled), not by
 *   volumetric_fog (which has no three.js equivalent — see PARITY-LIMITATIONS).
 */
import { describe, it, expect } from 'vitest';
import { parseEnvironment } from './parser';
import { createEnvironmentSettings } from './renderer';

describe('Environment Godot parity', () => {
  it('ambient_light_color defaults to black (not white)', () => {
    expect(parseEnvironment({}).ambient_light_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses ambient_light_source (default 0 = BG)', () => {
    expect(parseEnvironment({}).ambient_light_source).toBe(0);
    expect(parseEnvironment({ ambient_light_source: '2' }).ambient_light_source).toBe(2);
  });

  it('emits no flat ambient for BG/DISABLED source; emits for COLOR source', () => {
    expect(createEnvironmentSettings(parseEnvironment({})).ambient).toBeNull(); // BG default
    expect(createEnvironmentSettings(parseEnvironment({ ambient_light_source: '1' })).ambient).toBeNull(); // DISABLED
    const colored = createEnvironmentSettings(
      parseEnvironment({ ambient_light_source: '2', ambient_light_color: 'Color(0.2, 0.2, 0.2, 1)' })
    );
    expect(colored.ambient).not.toBeNull();
  });

  it('parses screen-space fog (fog_enabled / fog_density / fog_mode)', () => {
    const p = parseEnvironment({ fog_enabled: 'true', fog_density: '0.02', fog_mode: '1' });
    expect(p.fog_enabled).toBe(true);
    expect(p.fog_density).toBeCloseTo(0.02, 5);
    expect(p.fog_mode).toBe(1);
  });

  it('drives scene fog from screen-space fog_enabled, not volumetric_fog', () => {
    const screen = createEnvironmentSettings(parseEnvironment({ fog_enabled: 'true', fog_density: '0.01' }));
    expect(screen.fog).not.toBeNull();
    expect(screen.fog?.density).toBeCloseTo(0.01, 5);

    // volumetric-only must NOT drive scene fog (no three.js equivalent)
    const volOnly = createEnvironmentSettings(
      parseEnvironment({ volumetric_fog_enabled: 'true', volumetric_fog_density: '0.05' })
    );
    expect(volOnly.fog).toBeNull();
  });
});
