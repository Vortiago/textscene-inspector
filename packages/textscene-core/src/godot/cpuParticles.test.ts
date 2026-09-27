/**
 * The CPUParticles parameter pairs, and which bound of a crossed pair Godot moves at load.
 * Expected values measured on Godot 4.6.3 for both CPUParticles2D and CPUParticles3D.
 */
import { describe, it, expect } from 'vitest';
import { CPU_PARTICLES_PARAMS, crossedParamRanges } from './cpuParticles.js';

describe('crossedParamRanges', () => {
  it('moves a min listed first onto the max', () => {
    expect(crossedParamRanges({ initial_velocity_min: '5.0', initial_velocity_max: '2.0' })).toEqual([
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
    expect(crossedParamRanges({ initial_velocity_max: '2.0', initial_velocity_min: '5.0' })).toEqual([
      expect.objectContaining({ movedKey: 'initial_velocity_max', loadedValue: 5 }),
    ]);
  });

  it('finds every crossed pair, in enum order', () => {
    const properties = Object.fromEntries(
      CPU_PARTICLES_PARAMS.flatMap((param) => [
        [`${param}_min`, '0.75'],
        [`${param}_max`, '0.25'],
      ])
    );
    expect(crossedParamRanges(properties).map((range) => range.movedKey)).toEqual(
      CPU_PARTICLES_PARAMS.map((param) => `${param}_min`)
    );
  });

  it('compares the stored real_t values, so a pair equal in storage is not crossed', () => {
    expect(crossedParamRanges({ scale_amount_min: '0.30000001', scale_amount_max: '0.3' })).toEqual([]);
  });

  it('ignores a pair at or below its max', () => {
    expect(crossedParamRanges({ angle_min: '-30', angle_max: '30' })).toEqual([]);
    expect(crossedParamRanges({ angle_min: '30', angle_max: '30' })).toEqual([]);
  });

  it('ignores a pair with one key absent, since only the default moves', () => {
    expect(crossedParamRanges({ scale_amount_min: '5' })).toEqual([]);
    expect(crossedParamRanges({ scale_amount_max: '0.5' })).toEqual([]);
  });

  it('ignores nan, which no comparison crosses, and a value that is not a float', () => {
    expect(crossedParamRanges({ angle_min: 'nan', angle_max: '0' })).toEqual([]);
    expect(crossedParamRanges({ angle_min: '"fast"', angle_max: '0' })).toEqual([]);
  });
});
