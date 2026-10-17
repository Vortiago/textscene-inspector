import { describe, it, expect } from 'vitest';
import {
  CPU_PARTICLES_2D_DRAW_ORDER_NAMES,
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
});
