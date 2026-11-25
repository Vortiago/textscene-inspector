import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import type { SkyLayers } from '../../resources/sky/octmapArrays';
import { hideShownSky, renderedSky, SkyRadiance, skyEnergies, skyRotation } from './skyRadiance';
import { REFLECTION_SLOT, shownValues, skyLayersSlot } from './skyRadiance.testkit';
import { boundHandle, testRenderer } from '../../testing/recordingWebGL';

/** A sky's layer array at radiance `radianceSize`, set up on `renderer` as a bake leaves it. */
function bakedLayers(renderer: THREE.WebGLRenderer, radianceSize = 32): SkyLayers {
  const layout = skyOctmapLayout(radianceSize, 8);
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, 8);
  renderer.initRenderTarget(target);
  return { layout, target };
}

/** A sky's radiance on `renderer` at radiance `radianceSize`, unturned unless `rotation` says. */
function radianceOf(
  renderer: THREE.WebGLRenderer,
  radianceSize = 32,
  rotation = new THREE.Euler()
): SkyRadiance {
  return new SkyRadiance(renderer, bakedLayers(renderer, radianceSize), rotation);
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

    first.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });
    const firstArray = sampledArray(renderer);
    second.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });
    const secondArray = sampledArray(renderer);
    first.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });

    expect(firstArray).not.toBe(secondArray);
    expect(sampledArray(renderer)).toBe(firstArray);
  });

  it('uploads nothing while two skies take turns', async () => {
    const { renderer, recording } = await testRenderer();
    const skies = [radianceOf(renderer), radianceOf(renderer)];
    const bakedUploads = recording.uploads();

    for (let frame = 0; frame < 3; frame++)
      for (const sky of skies)
        sky.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });

    expect(recording.uploads()).toBe(bakedUploads);
  });

  it("shows the sky's share of the ambient, its border size, and its derivative scale", async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer, 256).show({
      contribution: 0.25,
      isReflected: true,
      energies: [1],
      energyMultiplier: 1,
    });

    // One over `4 * pixel_size * pixel_size` at a pixel size of 1/256.
    expect(Array.from(shownValues.subarray(0, 3))).toEqual([0.25, Math.fround(0.8), 256 ** 2 / 4]);
  });

  it('shows the layout of the sky shown last (edge case)', async () => {
    const { renderer } = await testRenderer();
    radianceOf(renderer, 256).show({
      contribution: 1,
      isReflected: true,
      energies: [1],
      energyMultiplier: 1,
    });

    radianceOf(renderer, 32).show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });

    expect(shownValues[2]).toBe(32 ** 2 / 4);
  });

  it('leaves the readers sampling none of its array when hidden, as it is freed next (error case)', async () => {
    const { renderer } = await testRenderer();
    const sky = radianceOf(renderer);
    sky.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });

    sky.hide();

    expect(sampledArray(renderer)).toBeUndefined();
  });

  it('keeps the array another sky shows when hidden (edge case)', async () => {
    const { renderer } = await testRenderer();
    const shown = radianceOf(renderer);
    const hidden = radianceOf(renderer);
    hidden.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });
    shown.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });
    const shownArray = sampledArray(renderer);

    hidden.hide();

    expect(sampledArray(renderer)).toBe(shownArray);
  });

  it('shows the energy each layer was baked at, which every reader reads it at', async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer).show({
      contribution: 1,
      isReflected: true,
      energies: [4, 1, 2, 1, 1, 1, 1, 3],
      energyMultiplier: 1,
    });

    expect(Array.from(skyEnergies)).toEqual([4, 1, 2, 1, 1, 1, 1, 3]);
  });

  it('shows the last energy for each layer past the last, which a read of it reads (edge case)', async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer).show({ contribution: 1, isReflected: true, energies: [4, 2], energyMultiplier: 1 });

    expect(Array.from(skyEnergies)).toEqual([4, 2, 2, 2, 2, 2, 2, 2]);
  });

  it('shows 0 for a sky no surface reflects, and 1 for one they do', async () => {
    const { renderer } = await testRenderer();
    const radiance = radianceOf(renderer);

    radiance.show({ contribution: 1, isReflected: false, energies: [1], energyMultiplier: 1 });
    const unreflected = shownValues[REFLECTION_SLOT];
    radiance.show({ contribution: 1, isReflected: true, energies: [1], energyMultiplier: 1 });

    expect([unreflected, shownValues[REFLECTION_SLOT]]).toEqual([0, 1]);
  });

  it("shows world to sky space, the inverse of the sky's rotation", async () => {
    const { renderer } = await testRenderer();

    radianceOf(renderer, 32, new THREE.Euler(0, Math.PI / 2, 0)).show({
      contribution: 1,
      isReflected: true,
      energies: [1],
      energyMultiplier: 1,
    });

    // A quarter turn about Y takes the sky's +X to the world's -Z, so world -Z is sky +X.
    const worldForward = new THREE.Vector3(0, 0, -1).applyMatrix3(new THREE.Matrix3().fromArray(skyRotation));
    expect(worldForward.toArray().map((value) => Math.round(value * 1e6) / 1e6 + 0)).toEqual([1, 0, 0]);
  });
});

describe('hideShownSky', () => {
  it('leaves a scene without a sky reading black, unturned', async () => {
    const { renderer } = await testRenderer();
    radianceOf(renderer, 32, new THREE.Euler(1, 2, 3)).show({
      contribution: 1,
      isReflected: true,
      energies: [3],
      energyMultiplier: 1,
    });

    hideShownSky();

    expect([Math.max(...skyEnergies), Array.from(skyRotation)]).toEqual([0, [1, 0, 0, 0, 1, 0, 0, 0, 1]]);
  });
});

describe('renderedSky', () => {
  const surfaces = { contribution: 0.5, isReflected: false, energies: [2], energyMultiplier: 3 };

  it('gives the layers a render shows, with how its surfaces take them', async () => {
    const { renderer } = await testRenderer();
    const layers = bakedLayers(renderer);

    new SkyRadiance(renderer, layers, new THREE.Euler()).show(surfaces);

    expect(renderedSky()).toEqual({ ...surfaces, layers });
  });

  it('gives no sky once the render ends (edge case)', async () => {
    const { renderer } = await testRenderer();
    radianceOf(renderer).show(surfaces);

    hideShownSky();

    expect(renderedSky()).toBeNull();
  });

  it('gives no sky once the shown sky hides, as its array is freed next (error case)', async () => {
    const { renderer } = await testRenderer();
    const sky = radianceOf(renderer);
    sky.show(surfaces);

    sky.hide();

    expect(renderedSky()).toBeNull();
  });
});
