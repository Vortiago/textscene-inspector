import { describe, it, expect } from 'vitest';
import {
  CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES,
  CPU_PARTICLES_2D_DRAW_ORDER_NAMES,
  CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES,
  CPU_PARTICLES_2D_EMISSION_SHAPE_NAMES,
  GPU_PARTICLES_2D_DRAW_ORDER_NAMES,
} from './particles2d.js';

describe('2D particle names', () => {
  it('names the two CPUParticles2D draw orders, which have no REVERSE_LIFETIME', () => {
    expect(CPU_PARTICLES_2D_DRAW_ORDER_NAMES).toEqual({ 0: 'INDEX', 1: 'LIFETIME' });
  });

  it('names the three GPUParticles2D draw orders', () => {
    expect(GPU_PARTICLES_2D_DRAW_ORDER_NAMES).toEqual({
      0: 'INDEX',
      1: 'LIFETIME',
      2: 'REVERSE_LIFETIME',
    });
  });

  it('names each emission shape, EMISSION_SHAPE_MAX left out', () => {
    expect(CPU_PARTICLES_2D_EMISSION_SHAPE_NAMES).toEqual({
      0: 'POINT',
      1: 'SPHERE',
      2: 'SPHERE_SURFACE',
      3: 'RECTANGLE',
      4: 'POINTS',
      5: 'DIRECTED_POINTS',
      6: 'RING',
    });
  });

  it('labels the CPUParticles2D draw orders as the inspector hint does (cpu_particles_2d.cpp:1509)', () => {
    expect(CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES).toEqual({ 0: 'Index', 1: 'Lifetime' });
  });

  it('labels the emission shapes as the inspector hint does (cpu_particles_2d.cpp:1586)', () => {
    expect(CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES).toEqual({
      0: 'Point',
      1: 'Sphere',
      2: 'Sphere Surface',
      3: 'Rectangle',
      4: 'Points',
      5: 'Directed Points',
      6: 'Ring',
    });
  });
});
