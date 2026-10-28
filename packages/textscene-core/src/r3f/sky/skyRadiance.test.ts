import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import type { SkyLayers } from '../../resources/sky/skyLayers';
import { hideShownSky, SHOWN_ENERGY, SkyRadiance, shownSky, skyRotation, type SkyBake } from './skyRadiance';
import { skyLayersSlot } from './skyRadiance.testkit';
import { boundHandle, testRenderer } from '../../testing/recordingWebGL';

/** A sky's layer array at radiance `radianceSize`, set up on `renderer` as a bake leaves it. */
function bakedLayers(renderer: THREE.WebGLRenderer, radianceSize = 32): SkyLayers {
  const layout = skyOctmapLayout(radianceSize, 8);
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, 8);
  renderer.initRenderTarget(target);
  return { layout, target };
}

/** A sky's radiance on `renderer` at radiance `radianceSize`, at energy 1 and unturned unless `bake` says. */
function radianceOf(
  renderer: THREE.WebGLRenderer,
  radianceSize = 32,
  bake: Partial<SkyBake> = {}
): SkyRadiance {
  return new SkyRadiance(renderer, bakedLayers(renderer, radianceSize), {
    energy: 1,
    rotation: new THREE.Euler(),
    ...bake,
  });
}

/** The array handle every reader samples on `renderer`. */
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

describe('SkyRadiance', () => {
  it('points every reader at the array of the sky it shows', async () => {
    const { renderer } = await testRenderer();
    const first = radianceOf(renderer);
    const second = radianceOf(renderer);

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
    const skies = [radianceOf(renderer), radianceOf(renderer)];
    const bakedUploads = recording.uploads();

    for (let frame = 0; frame < 3; frame++) for (const sky of skies) sky.show(1);

    expect(recording.uploads()).toBe(bakedUploads);
  });

  it("shows the sky's share of the ambient, its border size, its derivative scale and its last mip", async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer, 256).show(0.25);

    // One over `4 * pixel_size * pixel_size` at a pixel size of 1/256.
    expect(Array.from(shownSky.subarray(0, 4))).toEqual([0.25, Math.fround(0.8), 256 ** 2 / 4, 6]);
  });

  it('shows the layout of the sky shown last (edge case)', async () => {
    const { renderer } = await testRenderer();
    radianceOf(renderer, 256).show(1);

    radianceOf(renderer, 32).show(1);

    expect([shownSky[2], shownSky[3]]).toEqual([32 ** 2 / 4, 3]);
  });

  it('leaves the readers sampling none of its array when hidden, as it is freed next (error case)', async () => {
    const { renderer } = await testRenderer();
    const sky = radianceOf(renderer);
    sky.show(1);

    sky.hide();

    expect(sampledArray(renderer)).toBeUndefined();
  });

  it('keeps the array another sky shows when hidden (edge case)', async () => {
    const { renderer } = await testRenderer();
    const shown = radianceOf(renderer);
    const hidden = radianceOf(renderer);
    hidden.show(1);
    shown.show(1);
    const shownArray = sampledArray(renderer);

    hidden.hide();

    expect(sampledArray(renderer)).toBe(shownArray);
  });

  it('shows the energy its radiance holds, which the fogs read', async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer, 32, { energy: 2.5 }).show(1);

    expect(shownSky[SHOWN_ENERGY]).toBe(2.5);
  });

  it("shows world to sky space, the inverse of the sky's rotation", async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer, 32, { rotation: new THREE.Euler(0, Math.PI / 2, 0) }).show(1);

    // A quarter turn about Y takes the sky's +X to the world's -Z, so world -Z is sky +X.
    const worldForward = new THREE.Vector3(0, 0, -1).applyMatrix3(new THREE.Matrix3().fromArray(skyRotation));
    expect(worldForward.toArray().map((value) => Math.round(value * 1e6) / 1e6 + 0)).toEqual([1, 0, 0]);
  });
});

describe('hideShownSky', () => {
  it('leaves a scene without a sky reading black, unturned', async () => {
    const { renderer } = await testRenderer();
    radianceOf(renderer, 32, { energy: 3, rotation: new THREE.Euler(1, 2, 3) }).show(1);

    hideShownSky();

    expect([shownSky[SHOWN_ENERGY], Array.from(skyRotation)]).toEqual([0, [1, 0, 0, 0, 1, 0, 0, 0, 1]]);
  });
});
