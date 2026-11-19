import { describe, expect, it, vi } from 'vitest';
import { testRenderer } from '../../testing/recordingWebGL';
import { OctmapRadiance, octmapSkyEnvironment, type OctmapSky } from './octmapRadiance';
import type { SkyBake } from './types';

const BAKE: SkyBake = { radianceFilter: 'importance-sample', radianceSize: 32 };

/** An octmap sky that records the origin of each draw and whether it was freed. */
function recordedSky(draw: OctmapSky['draw'] = () => {}) {
  const origins: number[][] = [];
  const sky = {
    draw: vi.fn<OctmapSky['draw']>((gl, octmap, layout, position, energy) => {
      origins.push([position.x, position.y, position.z]);
      draw(gl, octmap, layout, position, energy);
    }),
    keepRadiance: vi.fn<NonNullable<OctmapSky['keepRadiance']>>(),
    dispose: vi.fn(),
  };
  return { sky, origins };
}

const NO_PARTS = { background: null, disposeBackground: () => {}, setLights: () => {} };

describe('OctmapRadiance', () => {
  it('bakes the first radiance with POSITION at the origin', async () => {
    const { renderer } = await testRenderer();
    const { sky, origins } = recordedSky();

    new OctmapRadiance(renderer, BAKE, sky, 1);

    expect(origins).toEqual([[0, 0, 0]]);
  });

  it('frees the octmap sky when the first bake fails (error case)', async () => {
    const { renderer } = await testRenderer();
    const { sky } = recordedSky(() => {
      throw new Error('expected a draw, got a lost context');
    });

    expect(() => new OctmapRadiance(renderer, BAKE, sky, 1)).toThrow('lost context');
    expect(sky.dispose).toHaveBeenCalledOnce();
  });

  it('bakes again at the origin it is given, and keeps the radiance for the next draw', async () => {
    const { renderer } = await testRenderer();
    const { sky, origins } = recordedSky();
    const radiance = new OctmapRadiance(renderer, BAKE, sky, 1);

    radiance.bakeAgain({ x: 1, y: 2, z: 3 }, 1);

    expect(origins.at(-1)).toEqual([1, 2, 3]);
    expect(sky.keepRadiance).toHaveBeenCalledTimes(2);
  });

  it('draws only layer 0 again for an incremental bake, and filters a layer without a draw', async () => {
    const { renderer } = await testRenderer();
    const { sky } = recordedSky();
    const radiance = new OctmapRadiance(renderer, BAKE, sky, 1);

    radiance.bakeFirstLayerAgain({ x: 0, y: 1, z: 0 }, 1);
    radiance.filterLayer(3);

    expect(sky.draw).toHaveBeenCalledTimes(2);
  });

  it('hands its layers to the caller and frees the octmap sky on release', async () => {
    const { renderer } = await testRenderer();
    const { sky } = recordedSky();

    const layers = new OctmapRadiance(renderer, BAKE, sky, 1).releaseLayers();

    expect(sky.dispose).toHaveBeenCalledOnce();
    expect(layers.target.depth).toBe(8);
  });
});

describe('OctmapRadiance kept layers', () => {
  const ORIGIN = { x: 0, y: 0, z: 0 };

  /** A radiance baked under key `A`, then `B`, with the array each bake drew into. */
  async function bakedTwice() {
    const { renderer } = await testRenderer();
    const { sky } = recordedSky();
    const radiance = new OctmapRadiance(renderer, BAKE, sky, 1);
    radiance.bakeAgain(ORIGIN, 1, 'A');
    const drawnForA = radiance.layers.target;
    radiance.bakeAgain(ORIGIN, 4, 'B');
    return { radiance, sky, drawnForA, drawnForB: radiance.layers.target };
  }

  it('bakes the next key into another array, so the layers of the key before stay as drawn', async () => {
    const { drawnForA, drawnForB } = await bakedTwice();

    expect(drawnForB).not.toBe(drawnForA);
  });

  it('holds the array the bake of the key before drew again, and draws nothing', async () => {
    const { radiance, sky, drawnForA } = await bakedTwice();
    const draws = sky.draw.mock.calls.length;

    radiance.bakeAgain(ORIGIN, 1, 'A');

    expect([radiance.layers.target, sky.draw.mock.calls.length]).toEqual([drawnForA, draws]);
  });

  it('keeps one array beside its layers, whatever keys bake in turn', async () => {
    const { radiance, drawnForA, drawnForB } = await bakedTwice();
    const held = new Set([drawnForA, drawnForB]);
    for (const key of ['C', 'A', 'D', 'C']) {
      radiance.bakeAgain(ORIGIN, 1, key);
      held.add(radiance.layers.target);
    }

    expect(held.size).toBe(2);
  });

  it('draws a bake under no key, as for a sky that reads TIME, and frees the kept layers', async () => {
    const { radiance, sky, drawnForA } = await bakedTwice();
    const freed = vi.spyOn(drawnForA, 'dispose');
    const draws = sky.draw.mock.calls.length;

    radiance.bakeAgain(ORIGIN, 1);
    radiance.bakeAgain(ORIGIN, 1, 'A');

    expect([freed.mock.calls.length, sky.draw.mock.calls.length - draws]).toEqual([1, 2]);
  });

  it('frees the kept layers with the radiance', async () => {
    const { radiance, drawnForA } = await bakedTwice();
    const freed = vi.spyOn(drawnForA, 'dispose');

    radiance.dispose();

    expect(freed).toHaveBeenCalledOnce();
  });
});

describe('octmapSkyEnvironment', () => {
  it('keeps a bake in place for a sky a render can dirty', async () => {
    const { renderer } = await testRenderer();
    const radiance = new OctmapRadiance(renderer, BAKE, recordedSky().sky, 1);

    const environment = octmapSkyEnvironment(radiance, true, NO_PARTS);

    expect(environment.radianceInPlace).toBe(radiance);
  });

  it('keeps only the layers of a sky no render dirties (edge case)', async () => {
    const { renderer } = await testRenderer();
    const { sky } = recordedSky();
    const radiance = new OctmapRadiance(renderer, BAKE, sky, 1);

    const environment = octmapSkyEnvironment(radiance, false, NO_PARTS);

    expect(environment.radianceInPlace).toBeUndefined();
    expect(sky.dispose).toHaveBeenCalledOnce();
  });

  it('frees the background and the radiance together', async () => {
    const { renderer } = await testRenderer();
    const { sky } = recordedSky();
    const disposeBackground = vi.fn();
    const radiance = new OctmapRadiance(renderer, BAKE, sky, 1);

    octmapSkyEnvironment(radiance, true, { ...NO_PARTS, disposeBackground }).dispose();

    expect([disposeBackground.mock.calls.length, sky.dispose.mock.calls.length]).toEqual([1, 1]);
  });
});
