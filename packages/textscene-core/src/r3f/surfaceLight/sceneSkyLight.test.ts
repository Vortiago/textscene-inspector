import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { hideShownSky, SkyRadiance } from '../sky/skyRadiance';
import { testRenderer } from '../../testing/recordingWebGL';
import { sceneSkyLight, unmixedAmbientLight } from './sceneSkyLight';
import type { SceneSky } from '../../shaders/spatial/sceneSky';

const surfaces = {
  contribution: 0.25,
  isAmbientSource: true,
  isReflected: true,
  energies: [2, 3],
  energyMultiplier: 1.5,
};

async function shownSkyAt(radianceSize: number) {
  const { renderer } = await testRenderer();
  const layout = skyOctmapLayout(radianceSize, 8);
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, 8);
  renderer.initRenderTarget(target);
  new SkyRadiance(renderer, { layout, target }, new THREE.Euler(0, Math.PI / 2, 0)).show(surfaces);
  return { layout, target };
}

afterEach(hideShownSky);

describe('sceneSkyLight', () => {
  it("gives the shown sky's layers and how surfaces take them", async () => {
    const { target } = await shownSkyAt(32);

    expect(sceneSkyLight()).toMatchObject({
      layers: target.texture,
      layerEnergies: [2, 3],
      pixelSize: 1 / 32,
      energyMultiplier: 1.5,
      ambientContribution: 0.25,
      isAmbientSource: true,
      isReflected: true,
    });
  });

  it("gives Godot's border of one side, not the width inside the padding", async () => {
    const { layout } = await shownSkyAt(32);

    expect(sceneSkyLight()!.borderSize).toBeCloseTo((1 - layout.borderSize) / 2, 12);
  });

  it('gives world to sky space as the inverse of the sky rotation', async () => {
    await shownSkyAt(32);

    const toSky = new THREE.Vector3(1, 0, 0).applyMatrix3(sceneSkyLight()!.worldToSky);

    // A quarter turn about Y takes the sky's +Z to the world's +X, so world +X is sky +Z.
    expect(toSky.x).toBeCloseTo(0, 6);
    expect(toSky.z).toBeCloseTo(1, 6);
  });

  it('gives nothing when the render shows no sky (edge case)', async () => {
    await shownSkyAt(32);

    hideShownSky();

    expect(sceneSkyLight()).toBeUndefined();
  });
});

describe('unmixedAmbientLight', () => {
  const sky = (ambientContribution: number) => ({ ambientContribution }) as SceneSky;
  const scaled = new THREE.Color(0.1, 0.2, 0.3);

  it('gives the flat light before the sky took its share', () => {
    const flat = unmixedAmbientLight(scaled, sky(0.5), new THREE.Color());

    expect(flat.toArray()).toEqual([0.2, 0.4, 0.6]);
  });

  it('gives the light as it is with no sky', () => {
    expect(unmixedAmbientLight(scaled, undefined, new THREE.Color()).toArray()).toEqual(scaled.toArray());
  });

  it('gives black when the sky takes all of the ambient light, which the template never reads (edge case)', () => {
    expect(unmixedAmbientLight(scaled, sky(1), new THREE.Color()).toArray()).toEqual([0, 0, 0]);
  });
});
