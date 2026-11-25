import { describe, expect, it } from 'vitest';
import { formatCPUParticles2DProperties } from './propertyFormatter';
import type { PropertySection } from '../../inspectedNode';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

function format(properties: Record<string, string> = {}) {
  return sectionsOf(formatCPUParticles2DProperties, 'CPUParticles2D', properties, { sub: { '4': 'Curve' } });
}

function value(sections: readonly PropertySection[], title: string, label: string) {
  return sectionTitled(sections, title)?.items.find((i) => i.label === label)?.value;
}

describe('formatCPUParticles2DProperties', () => {
  it('lists the emitter sections, then the Node2D ones', async () => {
    const sections = await format({ amount: '32', lifetime: '1.5', emitting: 'false' });
    expect(sectionTitled(sections, 'Emission')).toBeDefined();
    expect(sectionTitled(sections, 'Colour')).toBeDefined();
    expect(value(sections, 'Particles', 'Amount')).toBe('32');
    expect(value(sections, 'Particles', 'Lifetime')).toBe('1.50 s');
    expect(value(sections, 'Particles', 'Emitting')).toBe('No');
    expect(sectionTitled(sections, 'Position')).toBeDefined();
  });

  it('says the seed is randomised unless `use_fixed_seed` pins it', async () => {
    expect(value(await format({ seed: '4242' }), 'Particles', 'Seed')).toBe('randomised');
    expect(value(await format({ use_fixed_seed: 'true', seed: '4242' }), 'Particles', 'Seed')).toBe('4242');
  });

  it('spells out that fixed_fps = 0 means Godot’s 30 Hz fallback', async () => {
    expect(value(await format(), 'Particles', 'Fixed FPS')).toBe('30 (default)');
    expect(value(await format({ fixed_fps: '60' }), 'Particles', 'Fixed FPS')).toBe('60');
  });

  it('lists only the emission fields the chosen shape uses', async () => {
    const sphere = await format({ emission_shape: '1', emission_sphere_radius: '8' });
    expect(value(sphere, 'Emission', 'Sphere Radius')).toBe('8.00');
    expect(value(sphere, 'Emission', 'Rect Extents')).toBeUndefined();

    const rect = await format({ emission_shape: '3', emission_rect_extents: 'Vector2(20, 5)' });
    expect(value(rect, 'Emission', 'Rect Extents')).toBe('(20, 5)');
    expect(value(rect, 'Emission', 'Sphere Radius')).toBeUndefined();

    expect(value(await format({ emission_shape: '6' }), 'Emission', 'Ring Radius')).toBe('1.00');
  });

  it('lists no Parameters section when every slot is at its Godot default', async () => {
    expect(sectionTitled(await format(), 'Parameters')).toBeUndefined();
  });

  it('lists only the parameter slots off their default, and marks the curved ones', async () => {
    const sections = await format({
      initial_velocity_min: '50',
      initial_velocity_max: '75',
      scale_amount_curve: 'SubResource("4")',
    });
    const params = sectionTitled(sections, 'Parameters')!;
    expect(params.items.map((i) => i.label)).toEqual(['Initial Velocity', 'Scale Amount']);
    expect(params.items[0]!.value).toBe('50 … 75');
    expect(params.items[1]!.value).toBe('1 × curve');
  });

  it('names the empty resource slots as none', async () => {
    const sections = await format();
    expect(value(sections, 'Colour', 'Texture')).toBe('(none)');
    expect(value(sections, 'Colour', 'Color Ramp')).toBe('(none)');
    expect(value(sections, 'Colour', 'Color Initial Ramp')).toBe('(none)');
  });

  it('labels an out-of-range draw_order by its number', async () => {
    expect(value(await format({ draw_order: '7' }), 'Particles', 'Draw Order')).toBe('7');
  });
});
