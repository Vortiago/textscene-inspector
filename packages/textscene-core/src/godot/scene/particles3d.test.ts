import { describe, expect, it } from 'vitest';
import {
  CPU_PARTICLES_3D_DRAW_ORDER_NAMES,
  CPU_PARTICLES_3D_EMISSION_SHAPE_NAMES,
  GPU_PARTICLES_3D_DRAW_ORDER_NAMES,
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

  it('names the CPUParticles3D emission shapes, EMISSION_SHAPE_MAX left out (cpu_particles_3d.h:73-82)', () => {
    expect(CPU_PARTICLES_3D_EMISSION_SHAPE_NAMES).toEqual({
      0: 'POINT',
      1: 'SPHERE',
      2: 'SPHERE_SURFACE',
      3: 'BOX',
      4: 'POINTS',
      5: 'DIRECTED_POINTS',
      6: 'RING',
    });
  });
});
