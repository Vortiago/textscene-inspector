import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseCPUParticles2D } from './parser';
import { formatCPUParticles2DProperties } from './propertyFormatter';

function format(raw: Record<string, string> = {}) {
  return formatCPUParticles2DProperties(
    parseCPUParticles2D(heading('CPUParticles2D', { name: 'Fx' }), raw)
  );
}

function section(sections: ReturnType<typeof format>, title: string) {
  return sections.find((s) => s.title === title);
}

function value(sections: ReturnType<typeof format>, title: string, label: string) {
  return section(sections, title)?.items.find((i) => i.label === label)?.value;
}

describe('formatCPUParticles2DProperties', () => {
  it('lists the emitter surface plus the shared Node2D sections (happy path)', () => {
    const sections = format({ amount: '32', lifetime: '1.5', emitting: 'false' });
    expect(section(sections, 'Particles')).toBeDefined();
    expect(section(sections, 'Emission')).toBeDefined();
    expect(section(sections, 'Colour')).toBeDefined();
    expect(value(sections, 'Particles', 'Amount')).toBe('32');
    expect(value(sections, 'Particles', 'Lifetime')).toBe('1.50 s');
    expect(value(sections, 'Particles', 'Emitting')).toBe('No');
    // The Node2D formatter's own sections are appended.
    expect(sections.length).toBeGreaterThan(3);
  });

  it('says the seed is randomised unless `use_fixed_seed` pins it', () => {
    expect(value(format({ seed: '4242' }), 'Particles', 'Seed')).toBe('randomised');
    expect(
      value(format({ use_fixed_seed: 'true', seed: '4242' }), 'Particles', 'Seed')
    ).toBe('4242');
  });

  it('spells out that fixed_fps = 0 means Godot’s 30 Hz fallback', () => {
    expect(value(format(), 'Particles', 'Fixed FPS')).toBe('30 (default)');
    expect(value(format({ fixed_fps: '60' }), 'Particles', 'Fixed FPS')).toBe('60');
  });

  it('shows only the emission fields the chosen shape actually uses', () => {
    const sphere = format({ emission_shape: '1', emission_sphere_radius: '8' });
    expect(value(sphere, 'Emission', 'Sphere Radius')).toBe('8.00');
    expect(value(sphere, 'Emission', 'Rect Extents')).toBeUndefined();

    const rect = format({ emission_shape: '3', emission_rect_extents: 'Vector2(20, 5)' });
    expect(value(rect, 'Emission', 'Rect Extents')).toBe('(20, 5)');
    expect(value(rect, 'Emission', 'Sphere Radius')).toBeUndefined();

    const ring = format({ emission_shape: '6' });
    expect(value(ring, 'Emission', 'Ring Radius')).toBe('1.00');
  });

  it('omits the Parameters section when every slot is at its Godot default', () => {
    expect(section(format(), 'Parameters')).toBeUndefined();
  });

  it('lists only the non-default parameter slots, marking the curved ones', () => {
    const sections = format({
      initial_velocity_min: '50',
      initial_velocity_max: '75',
      scale_amount_curve: 'SubResource("4")',
    });
    const params = section(sections, 'Parameters')!;
    expect(params.items.map((i) => i.label)).toEqual(['Initial Velocity', 'Scale Amount']);
    expect(params.items[0]!.value).toBe('50 … 75');
    expect(params.items[1]!.value).toBe('1 × curve');
  });

  it('reports "(none)" for the unset resource slots (edge case)', () => {
    const sections = format();
    expect(value(sections, 'Colour', 'Texture')).toBe('(none)');
    expect(value(sections, 'Colour', 'Color Ramp')).toBe('(none)');
    expect(value(sections, 'Colour', 'Color Initial Ramp')).toBe('(none)');
  });

  it('labels an out-of-range draw_order by its raw number (error path)', () => {
    expect(value(format({ draw_order: '215832976' }), 'Particles', 'Draw Order')).toBe('Index');
  });
});
