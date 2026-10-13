/**
 * The sky bakes the lights the scene draws after they settle, and bakes again when they change.
 * The build itself needs a real GL context, so it is replaced by a spy on the lights it receives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { SkyEnvironment, SkyEnvironmentInput } from '../../resources/sky/build';
import type { PanoramaSkyProperties } from '../../resources/sky/types';
import { SkyLayer } from './SkyLayer';
import { skyLightUserData } from './skyLight';
import { showSkyLayers, skyContribution, skyLastLayerMap } from './skyLayersMap';
import type { SkyLayers } from '../../resources/sky/skyLayers';

const bakes = vi.hoisted((): SkyEnvironmentInput[] => []);
/** What the next bake returns: null, as a headless renderer gives, unless a test sets it. */
const built = vi.hoisted(() => ({ next: null as SkyEnvironment | null }));

vi.mock('../../resources/sky/build', () => ({
  buildSkyEnvironment: (_gl: unknown, input: SkyEnvironmentInput) => {
    bakes.push(input);
    return built.next;
  },
}));

const SKY: PanoramaSkyProperties = { kind: 'panorama', panorama: undefined, energy_multiplier: 1 };

function Scene({ lights }: { lights: number }) {
  return (
    <>
      <SkyLayer sky={SKY} />
      {Array.from({ length: lights }, (_, i) => (
        <directionalLight key={i} position={[i + 1, 2, 3]} />
      ))}
    </>
  );
}

const lastBake = () => bakes[bakes.length - 1];

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** In `act`, so the key a frame sets reaches the bake effect before the assertion. */
const advance = (renderer: Renderer, frames: number) =>
  ReactThreeTestRenderer.act(() => renderer.advanceFrames(frames, 0));

afterEach(() => {
  bakes.length = 0;
  built.next = null;
});

function skyEnvironment(layers: SkyLayers): SkyEnvironment {
  return { background: new THREE.Texture(), environment: new THREE.Texture(), layers, dispose: () => {} };
}

const blankFaces = () => Array.from({ length: 6 }, () => new Uint16Array(4));
const skyLayers = (): SkyLayers => ({ rough: [blankFaces()], last: blankFaces() });

/** The first face of the shared last-layer cube after the scene's next render starts. */
function layersAfterRender(renderer: Renderer): unknown {
  const { onBeforeRender } = renderer.scene.instance as unknown as THREE.Scene;
  (onBeforeRender as () => void)();
  return (skyLastLayerMap.image as THREE.DataTexture[])[0]!.image.data;
}

describe('SkyLayer', () => {
  it('waits for a frame to read the lights before it bakes', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    expect(bakes).toHaveLength(0);

    await advance(renderer, 1);

    expect(bakes).toHaveLength(1);
    expect(lastBake()?.lights).toHaveLength(1);
  });

  it('bakes again when a light unmounts after the bake', async () => {
    // The editor preview sun does this when the scene's own sun arrives. A stale bake keeps its
    // disc, and every glossy surface reflects it.
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={2} />);
    await advance(renderer, 1);
    expect(lastBake()?.lights).toHaveLength(2);

    await renderer.update(<Scene lights={1} />);
    await advance(renderer, 1);

    expect(lastBake()?.lights).toHaveLength(1);
  });

  it('does not bake again while the lights stay the same', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    await advance(renderer, 3);

    expect(bakes).toHaveLength(1);
  });

  it('leaves out a light that declares it draws nothing in the sky', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <SkyLayer sky={SKY} />
        <directionalLight position={[1, 2, 3]} />
        <directionalLight
          position={[3, 2, 1]}
          userData={skyLightUserData({ drawsInSky: false, energy: 1 })}
        />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights).toHaveLength(1);
  });

  it('draws a light at its declared energy, though it lights no surface (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <SkyLayer sky={SKY} />
        <directionalLight intensity={0} userData={skyLightUserData({ drawsInSky: true, energy: 2 })} />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.energy).toBe(2);
  });

  it('draws a light that declares nothing at its intensity over the scale (error case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <SkyLayer sky={SKY} />
        <directionalLight intensity={Math.PI * 3} />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.energy).toBeCloseTo(3);
  });

  it("shows the sky's layers in the shared cube before each render of its scene", async () => {
    const layers = skyLayers();
    built.next = skyEnvironment(layers);
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    await advance(renderer, 1);

    expect(layersAfterRender(renderer)).toBe(layers.last[0]);
  });

  it('shows its share of the ambient with its layers', async () => {
    built.next = skyEnvironment(skyLayers());
    const renderer = await ReactThreeTestRenderer.create(<SkyLayer sky={SKY} contribution={0.25} />);
    await advance(renderer, 1);

    layersAfterRender(renderer);

    expect(skyContribution[0]).toBe(0.25);
  });

  it('shows a new share of the ambient without a new bake', async () => {
    built.next = skyEnvironment(skyLayers());
    const renderer = await ReactThreeTestRenderer.create(<SkyLayer sky={SKY} contribution={0.25} />);
    await advance(renderer, 1);
    const bakeCount = bakes.length;

    await renderer.update(<SkyLayer sky={SKY} contribution={0.5} />);
    layersAfterRender(renderer);

    expect([bakes.length, skyContribution[0]]).toEqual([bakeCount, 0.5]);
  });

  it('stops showing its layers when it unmounts', async () => {
    const layers = skyLayers();
    built.next = skyEnvironment(layers);
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    await advance(renderer, 1);

    await renderer.update(<directionalLight />);
    const other = skyLayers();
    showSkyLayers(other, 1);

    expect(layersAfterRender(renderer)).toBe(other.last[0]);
  });

  it('shows no layers when the sky cannot render (error case)', async () => {
    const other = skyLayers();
    showSkyLayers(other, 1);
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    await advance(renderer, 1);

    expect(layersAfterRender(renderer)).toBe(other.last[0]);
  });
});
