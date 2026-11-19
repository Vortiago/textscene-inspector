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
