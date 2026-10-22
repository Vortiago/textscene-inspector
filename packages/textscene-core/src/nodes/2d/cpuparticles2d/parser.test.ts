import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseCPUParticles2D } from './parser';
import { CPU_PARTICLES_2D_PARAM_COUNT } from './types';
import { CPUParticles2DDrawOrder, CPUParticles2DEmissionShape } from '../../../godot/scene/particles2d';
import { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';

describe('parseCPUParticles2D', () => {
  it('parses the isometric candle’s Fire emitter (happy path)', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'Fire', parent: 'Sprite2D' }), {
      light_mask: '128',
      material: 'SubResource("1")',
      position: 'Vector2(-13, -35)',
      scale: 'Vector2(0.6, 0.6)',
      amount: '1',
      texture: 'ExtResource("3")',
      lifetime: '0.8',
      gravity: 'Vector2(0, 0)',
      color_ramp: 'SubResource("2")',
    });

    expect(result.name).toBe('Fire');
    expect(result.amount).toBe(1);
    expect(result.texture).toBe('ExtResource("3")');
    expect(result.lifetime).toBeCloseTo(0.8, 6);
    expect(result.gravity).toEqual({ x: 0, y: 0 });
    expect(result.color_ramp).toBe('SubResource("2")');
    expect(result.position).toEqual({ x: -13, y: -35 });
    // Unset properties take Godot's constructor defaults, not zero.
    expect(result.emitting).toBe(true);
    expect(result.spread).toBe(45);
    expect(result.direction).toEqual({ x: 1, y: 0 });
  });

  it('reads every Godot default when the body is empty (edge case)', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'Bare' }), {});

    expect(result.emitting).toBe(true);
    expect(result.amount).toBe(8);
    expect(result.lifetime).toBe(1);
    expect(result.one_shot).toBe(false);
    expect(result.preprocess).toBe(0);
    expect(result.speed_scale).toBe(1);
    expect(result.explosiveness).toBe(0);
    expect(result.randomness).toBe(0);
    expect(result.use_fixed_seed).toBe(false);
    expect(result.seed).toBe(0);
    expect(result.lifetime_randomness).toBe(0);
    expect(result.fixed_fps).toBe(0);
    expect(result.fract_delta).toBe(true);
    expect(result.local_coords).toBe(false);
    expect(result.draw_order).toBe(CPUParticles2DDrawOrder.INDEX);
    expect(result.emission_shape).toBe(CPUParticles2DEmissionShape.POINT);
    expect(result.emission_sphere_radius).toBe(1);
    expect(result.emission_rect_extents).toEqual({ x: 1, y: 1 });
    expect(result.emission_ring_radius).toBe(1);
    expect(result.emission_ring_inner_radius).toBeCloseTo(0.8, 6);
    expect(result.particle_flag_align_y).toBe(false);
    expect(result.gravity).toEqual({ x: 0, y: 980 });
    expect(result.color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(result.texture).toBeUndefined();
    expect(result.color_ramp).toBeUndefined();
    expect(result.color_initial_ramp).toBeUndefined();
  });

  it('defaults every parameter range to 0 except Scale, which defaults to 1', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {});
    expect(result.params).toHaveLength(CPU_PARTICLES_2D_PARAM_COUNT);
    for (const param of result.params) expect(param.curve).toBeUndefined();

    expect(result.params[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]).toEqual({ min: 0, max: 0 });
    expect(result.params[CPUParticlesParameter.DAMPING]).toEqual({ min: 0, max: 0 });
    expect(result.params[CPUParticlesParameter.SCALE]).toEqual({ min: 1, max: 1 });
  });

  it('reads each parameter triple from its own serialised property names', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      initial_velocity_min: '50.0',
      initial_velocity_max: '75.0',
      angular_velocity_min: '-90.0',
      angular_velocity_max: '90.0',
      angular_velocity_curve: 'SubResource("av")',
      scale_amount_min: '0.5',
      scale_amount_max: '2.0',
      scale_amount_curve: 'SubResource("4")',
      anim_offset_max: '1.0',
    });

    expect(result.params[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]).toEqual({ min: 50, max: 75 });
    expect(result.params[CPUParticlesParameter.ANGULAR_VELOCITY]).toEqual({
      min: -90,
      max: 90,
      curve: 'SubResource("av")',
    });
    expect(result.params[CPUParticlesParameter.SCALE]).toEqual({
      min: 0.5,
      max: 2,
      curve: 'SubResource("4")',
    });
    expect(result.params[CPUParticlesParameter.ANIM_OFFSET]).toEqual({ min: 0, max: 1 });
  });

  it('loads a crossed range as the key listed last, as the paired setters leave it (`cpu_particles_2d.cpp:352-376`)', () => {
    const minFirst = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      angle_min: '5.0',
      angle_max: '2.0',
    });
    const maxFirst = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      angle_max: '2.0',
      angle_min: '5.0',
    });

    expect(minFirst.params[CPUParticlesParameter.ANGLE]).toEqual({ min: 2, max: 2 });
    expect(maxFirst.params[CPUParticlesParameter.ANGLE]).toEqual({ min: 5, max: 5 });
  });

  it('moves the default of a range with one key authored (measured: scale_amount_min = 3 loads max 3)', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), { scale_amount_min: '3.0' });

    expect(result.params[CPUParticlesParameter.SCALE]).toEqual({ min: 3, max: 3 });
  });

  it('clamps `amount` into Godot’s 1..1,000,000 range (edge case)', () => {
    const tooMany = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      amount: '5000000',
    });
    // cpu_particles_2d.cpp:1492 hints `amount` as "1,1000000,1,exp".
    expect(tooMany.amount).toBe(1_000_000);

    const tooFew = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), { amount: '0' });
    expect(tooFew.amount).toBe(1);
  });

  it('falls back to Index for an out-of-range `draw_order` (error path)', () => {
    // Godot writes and reads `draw_order = 215832976`.
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      draw_order: '215832976',
    });
    expect(result.draw_order).toBe(CPUParticles2DDrawOrder.INDEX);
  });

  it('falls back to Point for an unknown `emission_shape` (error path)', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      emission_shape: '99',
    });
    expect(result.emission_shape).toBe(CPUParticles2DEmissionShape.POINT);
  });

  it('keeps the Godot default when a numeric property is unparseable (error path)', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      lifetime: 'not-a-number',
      spread: 'nope',
      gravity: 'Vector2(bad)',
    });
    expect(result.lifetime).toBe(1);
    expect(result.spread).toBe(45);
    expect(result.gravity).toEqual({ x: 0, y: 980 });
  });

  it('reads `emitting = false`, which a script-triggered one-shot ships with', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'Explosion' }), {
      emitting: 'false',
      one_shot: 'true',
      explosiveness: '0.76',
    });
    expect(result.emitting).toBe(false);
    expect(result.one_shot).toBe(true);
    expect(result.explosiveness).toBeCloseTo(0.76, 6);
  });

  it('reads the determinism surface: use_fixed_seed, seed, fixed_fps, fract_delta', () => {
    const result = parseCPUParticles2D(heading('CPUParticles2D', { name: 'P' }), {
      use_fixed_seed: 'true',
      seed: '4242',
      fixed_fps: '30',
      fract_delta: 'false',
      local_coords: 'true',
      draw_order: '1',
    });
    expect(result.use_fixed_seed).toBe(true);
    expect(result.seed).toBe(4242);
    expect(result.fixed_fps).toBe(30);
    expect(result.fract_delta).toBe(false);
    expect(result.local_coords).toBe(true);
    expect(result.draw_order).toBe(CPUParticles2DDrawOrder.LIFETIME);
  });

  it('handles a heading with no attributes at all (edge case)', () => {
    const result = parseCPUParticles2D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.amount).toBe(8);
  });
});
