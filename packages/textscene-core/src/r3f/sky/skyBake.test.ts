import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { FastFilterQuality } from '../../godot/rendering/environment/skyReflection';
import type { Sky } from '../../resources/sky/types';
import { holdSkyBake } from './skyBake';

type BakeInput = Parameters<typeof holdSkyBake>[1];

const gl = {} as THREE.WebGLRenderer;

/** A bake input of `sky` at `fastFilterQuality`, with nothing else set. */
function inputOf(sky: Sky, fastFilterQuality?: FastFilterQuality): BakeInput {
  return {
    sky,
    fastFilterQuality,
    asBackground: true,
    lights: { lights: [], key: '' },
    buildEnvironment: () => null,
    energyMultiplier: 1,
    rotation: new THREE.Euler(),
  };
}

/** Whether `first` and `second` hold one bake of `sky`. */
function isSharedBake(sky: Sky, first?: FastFilterQuality, second?: FastFilterQuality): boolean {
  const held = holdSkyBake(gl, inputOf(sky, first), 0);
  const other = holdSkyBake(gl, inputOf(sky, second), 0);
  return held.bake === other.bake;
}

describe('holdSkyBake', () => {
  it('shares one bake of an importance-sampled sky across fast filter qualities', () => {
    const sky = { radianceFilter: 'importance-sample' } as Sky;

    expect(isSharedBake(sky, 'low', 'high')).toBe(true);
  });

  it('gives a fast-filtered sky a bake for each fast filter quality', () => {
    const sky = { radianceFilter: 'fast' } as Sky;

    expect(isSharedBake(sky, 'low', 'high')).toBe(false);
  });

  it('reads no fast filter quality as the low one', () => {
    const sky = { radianceFilter: 'fast' } as Sky;

    expect(isSharedBake(sky, undefined, 'low')).toBe(true);
  });
});
