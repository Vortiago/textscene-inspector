import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SKY_LAYER_GROUPS, type SkyLayers } from '../../resources/sky/skyLayers';
import { SkyLayerCubes, skyContribution, skyLayerSlots } from './skyLayerCubes';
import { boundHandle, recordTextures, testRenderer } from '../../testing/recordingWebGL';

const GROUPS = ['sharp', 'rough', 'last'] as const;

/** Six faces `size` wide, each holding `value`. */
function faces(size: number, value: number): Uint16Array[] {
  return Array.from({ length: 6 }, () =>
    new Uint16Array(size * size * 4).fill(THREE.DataUtils.toHalfFloat(value))
  );
}

function skyLayers(value: number): SkyLayers {
  const group = (sizes: readonly number[]) => sizes.map((size) => faces(size, value));
  return {
    sharp: group(SKY_LAYER_GROUPS.sharp.faceSizes),
    rough: group(SKY_LAYER_GROUPS.rough.faceSizes),
    last: group(SKY_LAYER_GROUPS.last.faceSizes),
  };
}

/** The cube handle each group's lit uniform samples on `renderer`. */
const sampledCubes = (renderer: THREE.WebGLRenderer) =>
  GROUPS.map((group) => boundHandle(renderer, skyLayerSlots[group]));

describe('skyLayerSlots', () => {
  it.each(GROUPS)('is its own clone, so every material samples the %s layers a sky shows', (group) => {
    expect(skyLayerSlots[group].clone()).toBe(skyLayerSlots[group]);
  });

  it('samples no cube before any sky shows (edge case)', async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);

    expect(sampledCubes(renderer)).toEqual([undefined, undefined, undefined]);
  });
});

describe('SkyLayerCubes', () => {
  it('points every lit material at the cubes of the sky it shows', async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);
    const first = new SkyLayerCubes(skyLayers(0.25));
    const second = new SkyLayerCubes(skyLayers(0.75));

    first.show(renderer, 1);
    const firstCubes = sampledCubes(renderer);
    second.show(renderer, 1);
    const secondCubes = sampledCubes(renderer);
    first.show(renderer, 1);

    expect(new Set([...firstCubes, ...secondCubes]).size).toBe(6);
    expect(sampledCubes(renderer)).toEqual(firstCubes);
  });

  it('uploads nothing after the first show while two skies take turns', async () => {
    const renderer = await testRenderer();
    const recording = recordTextures(renderer);
    const skies = [new SkyLayerCubes(skyLayers(0.25)), new SkyLayerCubes(skyLayers(0.75))];
    for (const sky of skies) sky.show(renderer, 1);
    const firstFrameUploads = recording.uploads();

    for (let frame = 0; frame < 3; frame++) for (const sky of skies) sky.show(renderer, 1);

    expect([firstFrameUploads > 0, recording.uploads()]).toEqual([true, firstFrameUploads]);
  });

  it("shows the sky's share of the ambient", async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);

    new SkyLayerCubes(skyLayers(0.5)).show(renderer, 0.3);

    expect(skyContribution[0]).toBeCloseTo(0.3);
  });

  it('shows a new share with cubes it already uploaded (edge case)', async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);
    const sky = new SkyLayerCubes(skyLayers(0.75));
    sky.show(renderer, 1);

    sky.show(renderer, 0);

    expect(skyContribution[0]).toBe(0);
  });

  it('frees its cubes when disposed', async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);
    const before = renderer.info.memory.textures;
    const sky = new SkyLayerCubes(skyLayers(0.5));
    sky.show(renderer, 1);

    sky.dispose();

    expect(renderer.info.memory.textures).toBe(before);
  });

  it('leaves the lit materials sampling no freed cube when disposed (error case)', async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);
    const sky = new SkyLayerCubes(skyLayers(0.5));
    sky.show(renderer, 1);

    sky.dispose();

    expect(sampledCubes(renderer)).toEqual([undefined, undefined, undefined]);
  });

  it('keeps the cubes another sky shows when disposed (edge case)', async () => {
    const renderer = await testRenderer();
    recordTextures(renderer);
    const shown = new SkyLayerCubes(skyLayers(0.25));
    const hidden = new SkyLayerCubes(skyLayers(0.75));
    hidden.show(renderer, 1);
    shown.show(renderer, 1);
    const shownCubes = sampledCubes(renderer);

    hidden.dispose();

    expect(sampledCubes(renderer)).toEqual(shownCubes);
  });
});
