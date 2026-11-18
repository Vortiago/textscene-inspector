import { describe, expect, it } from 'vitest';
import {
  newSkyRadianceUpdate,
  noteSkyFrame,
  restartSkyClock,
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

/** The kind of each step of `renders` renders of an incremental sky that `dirtied` renders dirty. */
function incrementalSteps(renders: number, dirtied: ReadonlySet<number>): string[] {
  const update = newSkyRadianceUpdate();
  const plan = { mode: 'incremental' as const, layers: 3 };
  return Array.from({ length: renders }, (_, index) => {
    const step = stepSkyRadiance(update, plan, { exposure: 1, brightness: 1 }, dirtied.has(index));
    if (step.kind === 'bake') return step.isFirstLayerOnly ? 'layer 0' : 'every layer';
    return step.kind === 'filter' ? `filter ${step.layer}` : 'none';
  });
}

describe('stepSkyRadiance steps', () => {
  it('bakes every layer of an incremental sky first, then filters one layer per render', () => {
    expect(incrementalSteps(4, new Set())).toEqual(['every layer', 'filter 1', 'filter 2', 'none']);
  });

  it('bakes layer 0 alone when an incremental sky is dirtied after its layers are done', () => {
    expect(incrementalSteps(5, new Set([3]))).toEqual([
      'every layer',
      'filter 1',
      'filter 2',
      'layer 0',
      'filter 1',
    ]);
  });

  it('holds a dirt until the layers are done, as Godot does (edge case)', () => {
    expect(incrementalSteps(4, new Set([1]))).toEqual(['every layer', 'filter 1', 'filter 2', 'layer 0']);
  });

  it('bakes every layer of a real-time sky in each render that dirties it', () => {
    const update = newSkyRadianceUpdate();
    const plan = { mode: 'real-time' as const, layers: 3 };
    const steps = [true, false, true].map((isDirtied) =>
      stepSkyRadiance(update, plan, { exposure: 1, brightness: 1 }, isDirtied)
    );
    expect(steps.map((step) => step.kind)).toEqual(['bake', 'none', 'bake']);
  });
});

describe('noteSkyFrame', () => {
  const ORIGIN = { x: 0, y: 0, z: 0 };
  const reads = (time: boolean, position: boolean) => ({ time, position });

  it('dirties a sky that reads TIME in a render whose TIME has moved on', () => {
    const update = newSkyRadianceUpdate();
    expect(noteSkyFrame(update, reads(true, false), 0.5, ORIGIN)).toBe(true);
    expect(noteSkyFrame(update, reads(true, false), 0.5, ORIGIN)).toBe(false);
    expect(noteSkyFrame(update, reads(true, false), 0.75, ORIGIN)).toBe(true);
  });

  it('leaves a sky clean for a step of TIME no larger than 0.00001 s, as Godot does', () => {
    const update = newSkyRadianceUpdate();
    noteSkyFrame(update, reads(true, false), 1, ORIGIN);
    expect(noteSkyFrame(update, reads(true, false), 1.000005, ORIGIN)).toBe(false);
  });

  it('leaves a sky clean when TIME goes back, after a rollover or a seek (edge case)', () => {
    const update = newSkyRadianceUpdate();
    noteSkyFrame(update, reads(true, false), 3, ORIGIN);
    expect(noteSkyFrame(update, reads(true, false), 1, ORIGIN)).toBe(false);
    expect(noteSkyFrame(update, reads(true, false), 2, ORIGIN)).toBe(false);
    expect(noteSkyFrame(update, reads(true, false), 3.5, ORIGIN)).toBe(true);
  });

  it('dirties a sky that reads POSITION in a render whose camera has moved', () => {
    const update = newSkyRadianceUpdate();
    expect(noteSkyFrame(update, reads(false, true), 0, ORIGIN)).toBe(false);
    expect(noteSkyFrame(update, reads(false, true), 0, { x: 0, y: 2, z: 0 })).toBe(true);
    expect(noteSkyFrame(update, reads(false, true), 0, { x: 0, y: 2.000001, z: 0 })).toBe(false);
  });

  it('dirties a sky that reads TIME after a restart, even at an earlier TIME', () => {
    const update = newSkyRadianceUpdate();
    noteSkyFrame(update, reads(true, false), 3, ORIGIN);
    restartSkyClock(update);
    expect(noteSkyFrame(update, reads(true, false), 0, ORIGIN)).toBe(true);
    expect(noteSkyFrame(update, reads(true, false), 0, ORIGIN)).toBe(false);
  });

  it('leaves a sky that reads neither clean', () => {
    const update = newSkyRadianceUpdate();
    expect(noteSkyFrame(update, reads(false, false), 4, { x: 1, y: 2, z: 3 })).toBe(false);
  });
});
