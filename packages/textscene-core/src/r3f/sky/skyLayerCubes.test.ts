import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SKY_LAYER_GROUPS, SKY_LAYER_GROUP_NAMES, type SkyLayers } from '../../resources/sky/skyLayers';
import { SkyLayerCubes, skyContribution, skyLayerSlots } from './skyLayerCubes';
import { boundHandle, renderTargetTestRenderer, testRenderer } from '../../testing/recordingWebGL';

/** A sky's layer cubes, set up on `renderer` as a bake leaves them. */
function bakedLayers(renderer: THREE.WebGLRenderer): SkyLayers {
  const cube = (group: keyof SkyLayers) => {
    const target = new THREE.WebGLCubeRenderTarget(SKY_LAYER_GROUPS[group].faceSizes[0]);
    renderer.initRenderTarget(target);
    return target;
  };
  return { sharp: cube('sharp'), rough: cube('rough'), last: cube('last') };
}

/** The cube handle each group's lit uniform samples on `renderer`. */
const sampledCubes = (renderer: THREE.WebGLRenderer) =>
  SKY_LAYER_GROUP_NAMES.map((group) => boundHandle(renderer, skyLayerSlots[group]));

describe('skyLayerSlots', () => {
  it.each(SKY_LAYER_GROUP_NAMES)(
    'is its own clone, so every material samples the %s layers a sky shows',
    (group) => {
      expect(skyLayerSlots[group].clone()).toBe(skyLayerSlots[group]);
    }
  );

  it('samples no cube before any sky shows (edge case)', async () => {
    const { renderer } = await testRenderer();

    expect(sampledCubes(renderer)).toEqual([undefined, undefined, undefined]);
  });
});

describe('SkyLayerCubes', () => {
  it('points every lit material at the cubes of the sky it shows', async () => {
    const { renderer } = await renderTargetTestRenderer();
    const first = new SkyLayerCubes(renderer, bakedLayers(renderer));
    const second = new SkyLayerCubes(renderer, bakedLayers(renderer));

    first.show(1);
    const firstCubes = sampledCubes(renderer);
    second.show(1);
    const secondCubes = sampledCubes(renderer);
    first.show(1);

    expect(new Set([...firstCubes, ...secondCubes]).size).toBe(6);
    expect(sampledCubes(renderer)).toEqual(firstCubes);
  });

  it('uploads nothing while two skies take turns', async () => {
    const { renderer, recording } = await renderTargetTestRenderer();
    const skies = [
      new SkyLayerCubes(renderer, bakedLayers(renderer)),
      new SkyLayerCubes(renderer, bakedLayers(renderer)),
    ];
    const bakedUploads = recording.uploads();

    for (let frame = 0; frame < 3; frame++) for (const sky of skies) sky.show(1);

    expect(recording.uploads()).toBe(bakedUploads);
  });

  it("shows the sky's share of the ambient", async () => {
    const { renderer } = await renderTargetTestRenderer();

    new SkyLayerCubes(renderer, bakedLayers(renderer)).show(0.3);

    expect(skyContribution[0]).toBeCloseTo(0.3);
  });

  it('shows a new share with the cubes it already shows (edge case)', async () => {
    const { renderer } = await renderTargetTestRenderer();
    const sky = new SkyLayerCubes(renderer, bakedLayers(renderer));
    sky.show(1);

    sky.show(0);

    expect(skyContribution[0]).toBe(0);
  });

  it('leaves the lit materials sampling none of its cubes when hidden, as they are freed next (error case)', async () => {
    const { renderer } = await renderTargetTestRenderer();
    const sky = new SkyLayerCubes(renderer, bakedLayers(renderer));
    sky.show(1);

    sky.hide();

    expect(sampledCubes(renderer)).toEqual([undefined, undefined, undefined]);
  });

  it('keeps the cubes another sky shows when hidden (edge case)', async () => {
    const { renderer } = await renderTargetTestRenderer();
    const shown = new SkyLayerCubes(renderer, bakedLayers(renderer));
    const hidden = new SkyLayerCubes(renderer, bakedLayers(renderer));
    hidden.show(1);
    shown.show(1);
    const shownCubes = sampledCubes(renderer);

    hidden.hide();

    expect(sampledCubes(renderer)).toEqual(shownCubes);
  });
});
