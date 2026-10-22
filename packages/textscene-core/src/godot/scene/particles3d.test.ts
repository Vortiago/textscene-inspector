import { describe, expect, it } from 'vitest';
import {
  CPU_PARTICLES_3D_DRAW_ORDER_NAMES,
  GPU_PARTICLES_3D_DRAW_ORDER_NAMES,
  GPU_PARTICLES_3D_TRANSFORM_ALIGN_NAMES,
  PARTICLE_COLLISION_MODE_NAMES,
  PARTICLE_EMISSION_SHAPE_NAMES,
  PARTICLE_SUB_EMITTER_MODE_NAMES,
} from './particles3d.js';

describe('particle enum label tables (3D)', () => {
  it('names the CPUParticles3D draw orders, DRAW_ORDER_MAX left out (cpu_particles_3d.h:43-48)', () => {
    expect(CPU_PARTICLES_3D_DRAW_ORDER_NAMES).toEqual({ 0: 'INDEX', 1: 'LIFETIME', 2: 'VIEW_DEPTH' });
  });

  it('names the GPUParticles3D draw orders, with REVERSE_LIFETIME before VIEW_DEPTH (gpu_particles_3d.h:41-46)', () => {
    expect(GPU_PARTICLES_3D_DRAW_ORDER_NAMES).toEqual({
      0: 'INDEX',
      1: 'LIFETIME',
      2: 'REVERSE_LIFETIME',
      3: 'VIEW_DEPTH',
    });
  });

  it('names the 4.6.3 alignments and the 4.7.2 LOCAL_BILLBOARD (gpu_particles_3d.h:50-56)', () => {
    expect(GPU_PARTICLES_3D_TRANSFORM_ALIGN_NAMES).toEqual({
      0: 'DISABLED',
      1: 'Z_BILLBOARD',
      2: 'Y_TO_VELOCITY',
      3: 'Z_BILLBOARD_Y_TO_VELOCITY',
      4: 'LOCAL_BILLBOARD',
    });
  });

  it('names the emission shapes, EMISSION_SHAPE_MAX left out (cpu_particles_3d.h:73-82)', () => {
    expect(PARTICLE_EMISSION_SHAPE_NAMES).toEqual({
      0: 'POINT',
      1: 'SPHERE',
      2: 'SPHERE_SURFACE',
      3: 'BOX',
      4: 'POINTS',
      5: 'DIRECTED_POINTS',
      6: 'RING',
    });
  });

  it('names the ParticleProcessMaterial collision modes, COLLISION_MAX left out (particle_process_material.h:103-108)', () => {
    expect(PARTICLE_COLLISION_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'RIGID', 2: 'HIDE_ON_CONTACT' });
  });

  it('names the ParticleProcessMaterial sub-emitter modes by value, not by hint order (particle_process_material.h:93-100)', () => {
    expect(PARTICLE_SUB_EMITTER_MODE_NAMES).toEqual({
      0: 'DISABLED',
      1: 'CONSTANT',
      2: 'AT_END',
      3: 'AT_COLLISION',
      4: 'AT_START',
    });
  });
});
