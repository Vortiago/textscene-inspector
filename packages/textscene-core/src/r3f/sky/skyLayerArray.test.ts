import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import type { SkyLayers } from '../../resources/sky/skyLayers';
import { SkyLayerArray, shownSky, skyLayersSlot } from './skyLayerArray';
import { boundHandle, testRenderer } from '../../testing/recordingWebGL';

/** A sky's layer array at radiance `radianceSize`, set up on `renderer` as a bake leaves it. */
function bakedLayers(renderer: THREE.WebGLRenderer, radianceSize = 32): SkyLayers {
  const layout = skyOctmapLayout(radianceSize, 8);
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, 8);
  renderer.initRenderTarget(target);
  return { layout, target };
}

/** The array handle every lit material samples on `renderer`. */
const sampledArray = (renderer: THREE.WebGLRenderer) => boundHandle(renderer, skyLayersSlot);

describe('skyLayersSlot', () => {
  it('is its own clone, so every material samples the layers a sky shows', () => {
    expect(skyLayersSlot.clone()).toBe(skyLayersSlot);
  });

  it('samples no array before any sky shows (edge case)', async () => {
    const { renderer } = await testRenderer();

    expect(sampledArray(renderer)).toBeUndefined();
  });
});

describe('SkyLayerArray', () => {
  it('points every lit material at the array of the sky it shows', async () => {
    const { renderer } = await testRenderer();
    const first = new SkyLayerArray(renderer, bakedLayers(renderer));
    const second = new SkyLayerArray(renderer, bakedLayers(renderer));

    first.show(1);
    const firstArray = sampledArray(renderer);
    second.show(1);
    const secondArray = sampledArray(renderer);
    first.show(1);

    expect(firstArray).not.toBe(secondArray);
    expect(sampledArray(renderer)).toBe(firstArray);
  });

  it('uploads nothing while two skies take turns', async () => {
    const { renderer, recording } = await testRenderer();
    const skies = [
      new SkyLayerArray(renderer, bakedLayers(renderer)),
      new SkyLayerArray(renderer, bakedLayers(renderer)),
    ];
    const bakedUploads = recording.uploads();

    for (let frame = 0; frame < 3; frame++) for (const sky of skies) sky.show(1);

    expect(recording.uploads()).toBe(bakedUploads);
  });

  it("shows the sky's share of the ambient, its border size, its derivative scale and its last mip", async () => {
    const { renderer } = await testRenderer();

    new SkyLayerArray(renderer, bakedLayers(renderer, 256)).show(0.25);

    // One over `4 * pixel_size * pixel_size` at a pixel size of 1/256.
    expect(Array.from(shownSky)).toEqual([0.25, Math.fround(0.8), 256 ** 2 / 4, 6]);
  });

  it('shows the layout of the sky shown last (edge case)', async () => {
    const { renderer } = await testRenderer();
    new SkyLayerArray(renderer, bakedLayers(renderer, 256)).show(1);

    new SkyLayerArray(renderer, bakedLayers(renderer, 32)).show(1);

    expect([shownSky[2], shownSky[3]]).toEqual([32 ** 2 / 4, 3]);
  });

  it('leaves the lit materials sampling none of its array when hidden, as it is freed next (error case)', async () => {
    const { renderer } = await testRenderer();
    const sky = new SkyLayerArray(renderer, bakedLayers(renderer));
    sky.show(1);

    sky.hide();

    expect(sampledArray(renderer)).toBeUndefined();
  });

  it('keeps the array another sky shows when hidden (edge case)', async () => {
    const { renderer } = await testRenderer();
    const shown = new SkyLayerArray(renderer, bakedLayers(renderer));
    const hidden = new SkyLayerArray(renderer, bakedLayers(renderer));
    hidden.show(1);
    shown.show(1);
    const shownArray = sampledArray(renderer);

    hidden.hide();

    expect(sampledArray(renderer)).toBe(shownArray);
  });
});
