/**
 * The sky bakes the lights the scene draws after they settle, and bakes again when they change.
 * The build itself needs a real GL context, so it is replaced by a spy on the lights it receives.
 */
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createPortal } from '@react-three/fiber';
import type { SkyEnvironment, SkyEnvironmentInput } from '../../resources/sky/build';
import type { Sky } from '../../resources/sky/types';
import { SkyLayer } from './SkyLayer';
import { skyLightUserData } from './skyLight';
import { observeSceneCamera } from '../sceneRenderCamera';
import { skyContribution, skyLayerSlots } from './skyLayerCubes';
import { boundHandle, recordTextures, RendererProbe, withRenderTargets } from '../../testing/recordingWebGL';
import type { SkyLayers } from '../../resources/sky/skyLayers';

const bakes = vi.hoisted((): SkyEnvironmentInput[] => []);
/** What the next bake returns on its renderer: null, as a headless renderer gives, unless a test sets it. */
const built = vi.hoisted(() => ({ next: null as ((gl: THREE.WebGLRenderer) => SkyEnvironment) | null }));

vi.mock('../../resources/sky/build', () => ({
  buildSkyEnvironment: (gl: THREE.WebGLRenderer, input: SkyEnvironmentInput) => {
    bakes.push(input);
    return built.next?.(gl) ?? null;
  },
}));

const NO_ROTATION = { x: 0, y: 0, z: 0 };

const SKY: Sky = {
  material: { kind: 'panorama', panorama: undefined, energy_multiplier: 1 },
  radianceFilter: 'importance-sample',
  radianceSize: 256,
};

function Scene({ lights }: { lights: number }) {
  return (
    <>
      <SkyLayer sky={SKY} rotation={NO_ROTATION} />
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

/** An environment as a bake on `gl` leaves it, its layer cubes set up, freed by `dispose`. */
function skyEnvironment(dispose: () => void = () => {}): (gl: THREE.WebGLRenderer) => SkyEnvironment {
  return (gl) => {
    const cube = () => {
      const target = new THREE.WebGLCubeRenderTarget(1);
      gl.initRenderTarget(target);
      return target;
    };
    const layers: SkyLayers = { sharp: cube(), rough: cube(), last: cube() };
    return { background: new THREE.Texture(), environment: new THREE.Texture(), layers, dispose };
  };
}

interface Mounted {
  scene: THREE.Scene;
  gl: THREE.WebGLRenderer;
  /** Renders `element` in place of the mounted one, as the same tree. */
  update: (element: React.ReactNode) => Promise<void>;
}

/**
 * Mounts `element` until the test ends and runs the frame that bakes its sky, recording the textures
 * from the start.
 */
async function mount(element: React.ReactNode): Promise<Mounted> {
  let gl: THREE.WebGLRenderer | undefined;
  const withProbe = (child: React.ReactNode) => (
    <>
      <RendererProbe onRenderer={(renderer) => (gl = renderer)} />
      {child}
    </>
  );
  const root = await ReactThreeTestRenderer.create(withProbe(element), { gl: withRenderTargets });
  onTestFinished(() => root.unmount());
  recordTextures(gl!);
  await advance(root, 1);
  const scene = root.scene.instance as unknown as THREE.Scene;
  return { scene, gl: gl!, update: (next) => root.update(withProbe(next)) };
}

/** Starts a render of `scene`, and gives the last-layer cube every lit material samples in it. */
function sampledInRender(gl: THREE.WebGLRenderer, scene: THREE.Scene): unknown {
  (scene.onBeforeRender as () => void)();
  return boundHandle(gl, skyLayerSlots.last);
}

/** A sky in the root scene, and one in a scene of its own, as a sub-viewport renders it. */
function TwoSkies({ subScene }: { subScene: THREE.Scene }) {
  return (
    <>
      <SkyLayer sky={SKY} rotation={NO_ROTATION} />
      {createPortal(<SkyLayer sky={SKY} rotation={NO_ROTATION} />, subScene)}
    </>
  );
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

  it.each([true, false])(
    'bakes the background only when the sky paints it (asBackground %s)',
    async (asBackground) => {
      const renderer = await ReactThreeTestRenderer.create(
        <SkyLayer sky={SKY} rotation={NO_ROTATION} asBackground={asBackground} />
      );
      await advance(renderer, 1);

      expect(lastBake()?.asBackground).toBe(asBackground);
    }
  );

  it('does not bake again while the lights stay the same', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    await advance(renderer, 3);

    expect(bakes).toHaveLength(1);
  });

  it('leaves out a light that declares it draws nothing in the sky', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <SkyLayer sky={SKY} rotation={NO_ROTATION} />
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
        <SkyLayer sky={SKY} rotation={NO_ROTATION} />
        <directionalLight intensity={0} userData={skyLightUserData({ drawsInSky: true, energy: 2 })} />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.energy).toBe(2);
  });

  it('draws a light that declares nothing at its intensity over the scale (error case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <SkyLayer sky={SKY} rotation={NO_ROTATION} />
        <directionalLight intensity={Math.PI * 3} />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.energy).toBeCloseTo(3);
  });

  it("points the lit materials at its sky's cubes before each render of its scene", async () => {
    built.next = skyEnvironment();
    const { scene, gl } = await mount(<Scene lights={1} />);

    expect(sampledInRender(gl, scene)).toBeDefined();
  });

  it("samples each scene's own sky in each scene's render", async () => {
    built.next = skyEnvironment();
    const subScene = new THREE.Scene();
    const { scene, gl } = await mount(<TwoSkies subScene={subScene} />);

    const [main, sub, mainAgain] = [scene, subScene, scene].map((rendered) => sampledInRender(gl, rendered));

    expect(sub).not.toBe(main);
    expect(mainAgain).toBe(main);
  });

  it('shows its share of the ambient with its layers', async () => {
    built.next = skyEnvironment();
    const { scene, gl } = await mount(<SkyLayer sky={SKY} rotation={NO_ROTATION} contribution={0.25} />);

    sampledInRender(gl, scene);

    expect(skyContribution[0]).toBe(0.25);
  });

  it('shows a new share of the ambient without a new bake', async () => {
    built.next = skyEnvironment();
    const { scene, gl, update } = await mount(
      <SkyLayer sky={SKY} rotation={NO_ROTATION} contribution={0.25} />
    );
    const bakeCount = bakes.length;

    await update(<SkyLayer sky={SKY} rotation={NO_ROTATION} contribution={0.5} />);
    sampledInRender(gl, scene);

    expect([bakes.length, skyContribution[0]]).toEqual([bakeCount, 0.5]);
  });

  it("keeps the scene's other render observers running, as the visibility cull is", async () => {
    built.next = skyEnvironment();
    const { scene, gl } = await mount(<Scene lights={1} />);
    const observer = vi.fn();
    const stopObserving = observeSceneCamera(scene, observer);

    sampledInRender(gl, scene);
    stopObserving();

    expect(observer).toHaveBeenCalled();
  });

  it('frees its environment when it unmounts', async () => {
    const dispose = vi.fn();
    built.next = skyEnvironment(dispose);
    const { scene, gl, update } = await mount(<Scene lights={1} />);
    sampledInRender(gl, scene);

    await update(<directionalLight />);

    expect(dispose).toHaveBeenCalledOnce();
  });

  it('stops showing its layers when it unmounts', async () => {
    built.next = skyEnvironment();
    const { scene, gl, update } = await mount(<Scene lights={1} />);
    sampledInRender(gl, scene);

    await update(<directionalLight />);

    expect(sampledInRender(gl, scene)).toBeUndefined();
  });

  it('bakes again when its renderer restores a lost context, which lost the bake', async () => {
    built.next = skyEnvironment();
    const { gl } = await mount(<Scene lights={1} />);
    const bakeCount = bakes.length;

    await ReactThreeTestRenderer.act(async () => {
      gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    });

    expect(bakes).toHaveLength(bakeCount + 1);
  });

  it('shows no layers when the sky cannot render (error case)', async () => {
    const { scene, gl } = await mount(<Scene lights={1} />);

    expect(sampledInRender(gl, scene)).toBeUndefined();
  });
});
