/**
 * The paired `_min`/`_max` setters, and which bound of a crossed pair Godot moves at load.
 * Expected values measured on Godot 4.6.3 for CPUParticles2D and ParticleProcessMaterial, whose
 * setters agree with CPUParticles3D's (`cpu_particles_3d.cpp:289-316`).
 */
import { describe, it, expect } from 'vitest';
import { CPU_PARTICLES_PARAMS } from './cpuParticles.js';
import {
  crossedParamRanges,
  finiteParamBounds,
  loadedParamRange,
  nonFiniteParamBounds,
} from './particleParamRange.js';
import { PARTICLE_PROCESS_MATERIAL_PARAMS } from './particles3d.js';

describe('crossedParamRanges', () => {
  it('moves a min listed first onto the max', () => {
    expect(
      crossedParamRanges({ initial_velocity_min: '5.0', initial_velocity_max: '2.0' }, CPU_PARTICLES_PARAMS)
    ).toEqual([
      {
        minKey: 'initial_velocity_min',
        maxKey: 'initial_velocity_max',
        min: 5,
        max: 2,
        movedKey: 'initial_velocity_min',
        loadedValue: 2,
      },
    ]);
  });

  it('moves a max listed first onto the min', () => {
    expect(
      crossedParamRanges({ initial_velocity_max: '2.0', initial_velocity_min: '5.0' }, CPU_PARTICLES_PARAMS)
    ).toEqual([expect.objectContaining({ movedKey: 'initial_velocity_max', loadedValue: 5 })]);
  });

  it('finds every crossed pair, in enum order', () => {
    const properties = Object.fromEntries(
      CPU_PARTICLES_PARAMS.flatMap((param) => [
        [`${param}_min`, '0.75'],
        [`${param}_max`, '0.25'],
      ])
    );
    expect(crossedParamRanges(properties, CPU_PARTICLES_PARAMS).map((range) => range.movedKey)).toEqual(
      CPU_PARTICLES_PARAMS.map((param) => `${param}_min`)
    );
  });

  it('compares the stored real_t values, so a pair equal in storage is not crossed', () => {
    expect(
      crossedParamRanges({ scale_amount_min: '0.30000001', scale_amount_max: '0.3' }, CPU_PARTICLES_PARAMS)
    ).toEqual([]);
  });

  it('ignores a pair at or below its max', () => {
    expect(crossedParamRanges({ angle_min: '-30', angle_max: '30' }, CPU_PARTICLES_PARAMS)).toEqual([]);
    expect(crossedParamRanges({ angle_min: '30', angle_max: '30' }, CPU_PARTICLES_PARAMS)).toEqual([]);
  });

  it('ignores a pair with one key absent, since only the default moves', () => {
    expect(crossedParamRanges({ scale_amount_min: '5' }, CPU_PARTICLES_PARAMS)).toEqual([]);
    expect(crossedParamRanges({ scale_amount_max: '0.5' }, CPU_PARTICLES_PARAMS)).toEqual([]);
  });

  it('ignores nan, which no comparison crosses, and a value that is not a float', () => {
    expect(crossedParamRanges({ angle_min: 'nan', angle_max: '0' }, CPU_PARTICLES_PARAMS)).toEqual([]);
    expect(crossedParamRanges({ angle_min: '"fast"', angle_max: '0' }, CPU_PARTICLES_PARAMS)).toEqual([]);
  });
});

describe('crossedParamRanges over the ParticleProcessMaterial pairs', () => {
  it('finds the pairs that only the material declares, in its parameter order', () => {
    const properties = {
      turbulence_initial_displacement_min: '5',
      turbulence_initial_displacement_max: '2',
      scale_over_velocity_max: '1',
      scale_over_velocity_min: '4',
    };
    expect(crossedParamRanges(properties, PARTICLE_PROCESS_MATERIAL_PARAMS).map((r) => r.movedKey)).toEqual([
      'turbulence_initial_displacement_min',
      'scale_over_velocity_max',
    ]);
  });

  it('does not read a pair the material lacks', () => {
    expect(
      crossedParamRanges({ scale_amount_min: '5', scale_amount_max: '2' }, PARTICLE_PROCESS_MATERIAL_PARAMS)
    ).toEqual([]);
  });
});

describe('crossedParamRanges with an infinite bound', () => {
  it('names the bound that Godot moves onto inf, which the setters accept', () => {
    expect(crossedParamRanges({ angle_min: 'inf', angle_max: '2' }, ['angle'])).toEqual([
      expect.objectContaining({ movedKey: 'angle_min', loadedValue: 2 }),
    ]);
  });
});

describe('loadedParamRange', () => {
  it('loads a crossed pair as the key listed last, min first', () => {
    expect(loadedParamRange({ angle_min: '5', angle_max: '2' }, 'angle', 0)).toEqual({ min: 2, max: 2 });
  });

  it('loads a crossed pair as the key listed last, max first', () => {
    expect(loadedParamRange({ angle_max: '2', angle_min: '5' }, 'angle', 0)).toEqual({ min: 5, max: 5 });
  });

  it('moves the default of a pair with one key authored (measured: min 3 on a default of 1)', () => {
    expect(loadedParamRange({ scale_amount_min: '3' }, 'scale_amount', 1)).toEqual({ min: 3, max: 3 });
    expect(loadedParamRange({ scale_amount_max: '0.5' }, 'scale_amount', 1)).toEqual({ min: 0.5, max: 0.5 });
  });

  it('keeps a pair at or below its max as written', () => {
    expect(loadedParamRange({ angle_min: '-30', angle_max: '30' }, 'angle', 0)).toEqual({
      min: -30,
      max: 30,
    });
  });

  it('answers the default for both ends when the file writes neither', () => {
    expect(loadedParamRange({}, 'scale_amount', 1)).toEqual({ min: 1, max: 1 });
  });

  it('skips a value that is not a float, as the slot would not take it (edge)', () => {
    expect(loadedParamRange({ angle_min: '"fast"', angle_max: '2' }, 'angle', 0)).toEqual({ min: 0, max: 2 });
  });

  it('skips a non-finite value, so the renderer keeps the default (edge)', () => {
    expect(loadedParamRange({ angle_min: 'inf', angle_max: 'nan' }, 'angle', 0)).toEqual({ min: 0, max: 0 });
  });

  it('skips a value that overflows a single-precision real to inf (edge)', () => {
    expect(loadedParamRange({ angle_min: '1e39', angle_max: '2' }, 'angle', 0)).toEqual({ min: 0, max: 2 });
  });
});

describe('nonFiniteParamBounds', () => {
  it('names a bound that is non-finite once stored, the ones loadedParamRange skips', () => {
    expect(
      nonFiniteParamBounds({ angle_min: 'inf', angle_max: '1e39', spread: 'inf' }, ['angle', 'spread'])
    ).toEqual(['angle_min', 'angle_max']);
  });

  it('names nothing for a finite bound, a refused value and an absent key (edge)', () => {
    expect(nonFiniteParamBounds({ angle_min: '3', angle_max: '"fast"' }, ['angle', 'damping'])).toEqual([]);
  });
});

describe('finiteParamBounds', () => {
  it('drops the non-finite bounds and keeps every other key in file order', () => {
    const kept = finiteParamBounds({ angle_min: 'inf', amount: '8', angle_max: '2' }, ['angle']);
    expect(Object.entries(kept)).toEqual([
      ['amount', '8'],
      ['angle_max', '2'],
    ]);
  });
});
