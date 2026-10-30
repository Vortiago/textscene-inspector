import { describe, expect, it } from 'vitest';
import {
  newSkyRadianceUpdate,
  skyUpdateMode,
  stepSkyRadiance,
  type SkyUpdateMode,
} from './skyRadianceUpdate';
import { SKY_ROUGHNESS_LAYERS_DEFAULT } from './skyReflection';

const LAYERS = SKY_ROUGHNESS_LAYERS_DEFAULT;

/** The exposure each render reads the radiance at, for renders at `exposures`, each one dirtying the sky when `dirties` says. */
function bakedAcross(
  mode: SkyUpdateMode,
  exposures: readonly number[],
  dirties: (index: number) => boolean
): number[] {
  const update = newSkyRadianceUpdate();
  return exposures.map((exposure, index) => {
    stepSkyRadiance(update, { mode, layers: LAYERS }, { exposure, brightness: exposure }, dirties(index));
    return update.baked!.exposure;
  });
}

/** Two drawers that take turns for `frames` frames, at exposures 4 and 1. */
const turns = (frames: number) => Array.from({ length: frames * 2 }, (_, index) => (index % 2 === 0 ? 4 : 1));

describe('skyUpdateMode', () => {
  it('processes an automatic sky incrementally, since every built-in sky material holds uniforms', () => {
    expect(skyUpdateMode('automatic')).toBe('incremental');
  });

  it('keeps the mode a sky names', () => {
    expect(skyUpdateMode('quality')).toBe('quality');
  });
});

describe('stepSkyRadiance', () => {
  it('bakes at the exposure of the first render', () => {
    expect(bakedAcross('incremental', [4, 1], () => false)).toEqual([4, 4]);
  });

  it('keeps the first bake while nothing dirties the sky', () => {
    expect(new Set(bakedAcross('incremental', turns(6), () => false))).toEqual(new Set([4]));
  });

  it('bakes again only once every layer has been processed, so two drawers keep the first one bake', () => {
    expect(new Set(bakedAcross('incremental', turns(12), () => true))).toEqual(new Set([4]));
  });

  it('bakes again at a render a whole layer cycle later, whichever drawer that is (edge case)', () => {
    const exposures = Array.from({ length: LAYERS + 1 }, (_, index) => (index === LAYERS ? 2 : 4));
    expect(bakedAcross('incremental', exposures, () => true).at(-1)).toBe(2);
  });

  it('bakes again in the render that dirties a quality sky', () => {
    expect(bakedAcross('quality', [4, 1, 4], () => true)).toEqual([4, 1, 4]);
  });

  it('keeps the brightness of the render that baked, for every render that reads the bake', () => {
    const update = newSkyRadianceUpdate();
    const plan = { mode: 'incremental' as const, layers: LAYERS };
    stepSkyRadiance(update, plan, { exposure: 4, brightness: 6 }, false);
    stepSkyRadiance(update, plan, { exposure: 1, brightness: 1 }, false);

    expect(update.baked).toEqual({ exposure: 4, brightness: 6 });
  });

  it('bakes again in the render that dirties a real-time sky', () => {
    expect(bakedAcross('real-time', [4, 1], () => true)).toEqual([4, 1]);
  });
});
