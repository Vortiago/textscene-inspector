/**
 * The sky bakes the lights the scene draws after they settle, and bakes again when they change.
 * The build itself needs a real GL context, so it is replaced by a spy on the lights it receives.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createPortal } from '@react-three/fiber';
import type { SkyEnvironment, SkyEnvironmentInput } from '../../resources/sky/build';
import type { Sky } from '../../resources/sky/types';
import { decodeSkyMaterial } from '../../resources/sky/decode';
import { SkyLayer } from './SkyLayer';
import { ownEnvironmentChanges, ShownEnvironment, useOwnEnvironment } from '../environment/sceneEnvironment';
import { skyLightUserData } from './skyLight';
import { observeSceneCamera } from '../sceneRenderCamera';
import { SHOWN_ENERGY, shownSky, skyRotation } from './skyRadiance';
import { REFLECTION_SLOT, skyLayersSlot } from './skyRadiance.testkit';
import { boundHandle, recordTextures, RendererProbe, withRenderTargets } from '../../testing/recordingWebGL';
import { skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { installFogComposite } from '../fog/fogComposite';
import { backgroundCube } from '../shaderPatch/backgroundPrograms';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';
import { installSkyDebanding } from './skyDebanding';
import { WorldExposureScope, usePublishCameraAttributes } from '../environment/worldExposure';
import { drawAtExposure } from '../exposure/sceneExposure';

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

/** The Environment each scene of these tests shows, which the sky belongs to. */
const ENVIRONMENT = {};

function ShownSkyLayer(props: React.ComponentProps<typeof SkyLayer>) {
  return (
    <ShownEnvironment environment={ENVIRONMENT}>
      <SkyLayer {...props} />
    </ShownEnvironment>
  );
}

/**
 * A panorama sky and a procedural one, new for each test: a sky's radiance update lives as long as
 * the sky (`radianceUpdateOf`).
 */
let panoramaSky: Sky;
let proceduralSky: Sky;

beforeEach(() => {
  panoramaSky = {
    material: { kind: 'panorama', panorama: undefined, energy_multiplier: 1 },
    processMode: 'automatic',
    radianceFilter: 'importance-sample',
    radianceSize: 256,
  };
  proceduralSky = { ...panoramaSky, material: decodeSkyMaterial('ProceduralSkyMaterial', {})! };
});

function Scene({ lights }: { lights: number }) {
  return (
    <>
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
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

/** An environment as a bake on `gl` leaves it, its layer array set up, freed by `dispose`. */
function skyEnvironment(dispose: () => void = () => {}): (gl: THREE.WebGLRenderer) => SkyEnvironment {
  return (gl) => {
    const target = new THREE.WebGLArrayRenderTarget(1, 1, 8);
    gl.initRenderTarget(target);
    const layers = { layout: skyOctmapLayout(32, 8), target };
    return { background: new THREE.Texture(), layers, dispose };
  };
}

interface Mounted {
  scene: THREE.Scene;
  gl: THREE.WebGLRenderer;
  /** Renders `element` in place of the mounted one, as the same tree. */
  update: (element: React.ReactNode) => Promise<void>;
  /** Runs `frames` frames of the mounted tree. */
  advanceFrames: (frames: number) => Promise<void>;
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
  return {
    scene,
    gl: gl!,
    update: (next) => root.update(withProbe(next)),
    advanceFrames: (frames) => advance(root, frames),
  };
}

/** Starts a render of `scene`, and gives the layer array every lit material samples in it. */
function sampledInRender(gl: THREE.WebGLRenderer, scene: THREE.Scene): unknown {
  (scene.onBeforeRender as () => void)();
  return boundHandle(gl, skyLayersSlot);
}

/** A sky in the root scene, and one in a scene of its own, as a sub-viewport renders it. */
function TwoSkies({ subScene }: { subScene: THREE.Scene }) {
  return (
    <>
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
      {createPortal(
        // Another Sky resource: scenes that draw one Sky share its bakes, as Godot shares its radiance.
        <ShownSkyLayer sky={{ ...panoramaSky }} rotation={NO_ROTATION} resources={NO_RESOURCES} />,
        subScene
      )}
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
        <ShownSkyLayer
          sky={panoramaSky}
          rotation={NO_ROTATION}
          resources={NO_RESOURCES}
          asBackground={asBackground}
        />
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
        <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
        <directionalLight position={[1, 2, 3]} />
        <directionalLight
          position={[3, 2, 1]}
          userData={skyLightUserData({ drawsInSky: false, energy: 1, size: 0 })}
        />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights).toHaveLength(1);
  });

  it('draws a light at its declared energy, though it lights no surface (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
        <directionalLight
          intensity={0}
          userData={skyLightUserData({ drawsInSky: true, energy: 2, size: 0 })}
        />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.energy).toBe(2);
  });

  it('draws a light’s sun disc at its declared size', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
        <directionalLight userData={skyLightUserData({ drawsInSky: true, energy: 1, size: 0.25 })} />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.size).toBe(0.25);
  });

  it('draws a light that declares nothing at its intensity over the scale (error case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
        <directionalLight intensity={Math.PI * 3} />
      </>
    );
    await advance(renderer, 1);

    expect(lastBake()?.lights[0]?.energy).toBeCloseTo(3);
  });

  it("points the lit materials at its sky's layer array before each render of its scene", async () => {
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
    const { scene, gl } = await mount(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} contribution={0.25} />
    );

    sampledInRender(gl, scene);

    expect(shownSky[0]).toBe(0.25);
  });

  it('shows whether surfaces reflect it, apart from its ambient', async () => {
    built.next = skyEnvironment();
    const { scene, gl } = await mount(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} reflects={false} />
    );

    sampledInRender(gl, scene);

    expect([shownSky[REFLECTION_SLOT], shownSky[0]]).toEqual([0, 1]);
  });

  it('shows the energy and the rotation of its radiance, which the fogs read', async () => {
    built.next = skyEnvironment();
    const { scene, gl } = await mount(
      <ShownSkyLayer
        sky={panoramaSky}
        rotation={{ x: 0, y: Math.PI / 2, z: 0 }}
        resources={NO_RESOURCES}
        energyMultiplier={1.5}
      />
    );

    sampledInRender(gl, scene);

    // A quarter turn about Y takes the sky's +X to the world's -Z.
    const skyForward = new THREE.Vector3(0, 0, -1).applyMatrix3(new THREE.Matrix3().fromArray(skyRotation));
    expect([shownSky[SHOWN_ENERGY], Math.round(skyForward.x)]).toEqual([1.5, 1]);
  });

  it('leaves the renders after its scene reading a black radiance', async () => {
    built.next = skyEnvironment();
    const { scene, gl } = await mount(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
    );
    sampledInRender(gl, scene);

    fireSceneRenderEnd(scene, new THREE.PerspectiveCamera());

    expect(shownSky[SHOWN_ENERGY]).toBe(0);
  });

  it('shows a new share of the ambient without a new bake', async () => {
    built.next = skyEnvironment();
    const { scene, gl, update } = await mount(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} contribution={0.25} />
    );
    const bakeCount = bakes.length;

    await update(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} contribution={0.5} />
    );
    sampledInRender(gl, scene);

    expect([bakes.length, shownSky[0]]).toEqual([bakeCount, 0.5]);
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

  it('shows one scene environment across bakes, so three resolves no program again', async () => {
    built.next = skyEnvironment();
    const { scene, update } = await mount(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
    );
    const firstBake = scene.environment;

    built.next = skyEnvironment();
    await update(
      <ShownSkyLayer sky={panoramaSky} rotation={{ x: 0, y: 1, z: 0 }} resources={NO_RESOURCES} />
    );

    expect(scene.environment).toBe(firstBake);
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

describe('SkyLayer debanding', () => {
  restoreShaderGlobalsAfterEach();

  beforeEach(() => {
    installFogComposite();
    installSkyDebanding();
    built.next = skyEnvironment();
  });

  /** The debanding noise's strength in a render of `scene`, which a debanded sky turns to 1. */
  function debandingInRender(scene: THREE.Scene): number {
    const camera = new THREE.Camera();
    fireSceneRender(scene, camera);
    const strength = (backgroundCube().uniforms.godotSkyDebanding!.value as Float32Array)[0]!;
    fireSceneRenderEnd(scene, camera);
    return strength;
  }

  it('adds the noise to the background of a sky that debands', async () => {
    const { scene } = await mount(
      <ShownSkyLayer sky={proceduralSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
    );

    expect(debandingInRender(scene)).toBe(1);
  });

  it('adds none to a panorama sky, which never debands', async () => {
    const { scene } = await mount(
      <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
    );

    expect(debandingInRender(scene)).toBe(0);
  });

  it('adds none when the sky paints no background (edge case)', async () => {
    const { scene } = await mount(
      <ShownSkyLayer
        sky={proceduralSky}
        rotation={NO_ROTATION}
        resources={NO_RESOURCES}
        asBackground={false}
      />
    );

    expect(debandingInRender(scene)).toBe(0);
  });

  it('adds none once the sky unmounts (error case)', async () => {
    const { scene, update } = await mount(
      <ShownSkyLayer sky={proceduralSky} rotation={NO_ROTATION} resources={NO_RESOURCES} />
    );

    await update(<directionalLight />);

    expect(debandingInRender(scene)).toBe(0);
  });
});

/** Publishes a CameraAttributes of `multiplier` to the world it is in. */
function Exposure({ multiplier }: { multiplier: number }) {
  usePublishCameraAttributes({
    status: 'resolved',
    attributes: { exposureMultiplier: multiplier, autoExposure: null },
  });
  return null;
}

function exposed(multiplier: number, children: React.ReactNode) {
  return (
    <WorldExposureScope>
      <Exposure multiplier={multiplier} />
      {children}
    </WorldExposureScope>
  );
}

/**
 * Godot bakes the sky's radiance at `background_energy_multiplier` times the exposure, and a surface
 * reads it at the exposure again (`render_forward_clustered.cpp:1993`, `:2045`,
 * `render_scene_data_rd.cpp:241-246`), so the exposure scales the ambient and the reflection twice
 * and the background once. The sky shader scales each light's energy too (`sky.cpp:1086`).
 */
describe('SkyLayer under an exposure', () => {
  /** The sky's `background_energy_multiplier`, which a surface reads twice and the background once. */
  const ENERGY = 1.5;
  const sky = (props: Partial<React.ComponentProps<typeof SkyLayer>> = {}) => (
    <ShownSkyLayer sky={panoramaSky} rotation={NO_ROTATION} resources={NO_RESOURCES} {...props} />
  );

  it('reads the ambient and the reflection at the sky energy squared, baked in and read again', async () => {
    built.next = skyEnvironment();
    const { scene } = await mount(sky({ energyMultiplier: 2 }));
    fireSceneRender(scene, new THREE.PerspectiveCamera());
    expect(scene.environmentIntensity).toBeCloseTo(4, 10);
  });

  it('reads the ambient and the reflection at the exposure squared', async () => {
    built.next = skyEnvironment();
    const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
    expect(scene.environmentIntensity).toBeCloseTo(ENERGY * ENERGY * 4, 10);
  });

  it('draws the background at the exposure', async () => {
    built.next = skyEnvironment();
    const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
    expect(scene.backgroundIntensity).toBeCloseTo(ENERGY * 2, 10);
  });

  it('leaves the background alone when the sky paints none', async () => {
    built.next = skyEnvironment();
    const { scene } = await mount(exposed(2, sky({ asBackground: false })));
    expect(scene.backgroundIntensity).toBe(1);
  });

  it('draws a declared light at its energy times the exposure', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      exposed(
        3,
        <>
          {sky({ sky: proceduralSky })}
          <directionalLight userData={skyLightUserData({ drawsInSky: true, energy: 2, size: 0 })} />
        </>
      )
    );
    await advance(renderer, 1);
    expect(lastBake()?.lights[0]?.energy).toBe(6);
  });

  it('draws a light that declares nothing at its intensity over the scale times the exposure', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      exposed(
        2,
        <>
          {sky({ sky: proceduralSky })}
          <directionalLight intensity={Math.PI * 3} />
        </>
      )
    );
    await advance(renderer, 1);
    expect(lastBake()?.lights[0]?.energy).toBeCloseTo(6, 10);
  });

  describe('drawn at another exposure', () => {
    const camera = new THREE.PerspectiveCamera();
    /** What `read` sees in a render of `scene` at `exposure`. */
    const drawnAt = <T,>(scene: THREE.Scene, exposure: number | null, read: () => T) =>
      drawAtExposure(scene, exposure, () => {
        fireSceneRender(scene, camera);
        return read();
      });

    it('reads the radiance the view baked at that exposure, and its own in its next render', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      fireSceneRender(scene, camera);
      const inside = drawnAt(scene, 3, () => scene.environmentIntensity);
      fireSceneRender(scene, camera);

      expect(inside).toBeCloseTo(ENERGY * ENERGY * 2 * 3, 10);
      expect(scene.environmentIntensity).toBeCloseTo(ENERGY * ENERGY * 4, 10);
    });

    it('draws the background at that exposure, and its own in its next render', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      const inside = drawnAt(scene, 3, () => scene.backgroundIntensity);
      fireSceneRender(scene, camera);

      expect(inside).toBeCloseTo(ENERGY * 3, 10);
      expect(scene.backgroundIntensity).toBeCloseTo(ENERGY * 2, 10);
    });

    it('draws at no exposure as at 1', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      fireSceneRender(scene, camera);
      const inside = drawnAt(scene, null, () => [scene.environmentIntensity, scene.backgroundIntensity]);
      expect(inside).toEqual([ENERGY * ENERGY * 2, ENERGY]);
    });

    it('leaves the background alone when the sky paints none', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ asBackground: false })));
      const inside = drawAtExposure(scene, 3, () => scene.backgroundIntensity);
      expect(inside).toBe(1);
    });

    it('stages nothing once the sky unmounts', async () => {
      built.next = skyEnvironment();
      const { scene, update } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      await update(exposed(2, null));
      const inside = drawAtExposure(scene, 3, () => scene.environmentIntensity);
      expect(inside).toBe(1);
    });
  });

  it('bakes the noise of a debanded sky for the brightness Godot bakes at', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      exposed(2, sky({ sky: proceduralSky, energyMultiplier: ENERGY }))
    );
    await advance(renderer, 1);
    expect(lastBake()?.energy).toBeCloseTo(ENERGY * 2, 10);
  });

  it('bakes again when the exposure changes', async () => {
    const renderer = await ReactThreeTestRenderer.create(exposed(2, sky()));
    await advance(renderer, 1);
    const bakeCount = bakes.length;

    await renderer.update(exposed(5, sky()));
    await advance(renderer, 1);

    expect(bakes.length).toBeGreaterThan(bakeCount);
  });

  it('darkens the sky under an exposure of 0 (edge case)', async () => {
    built.next = skyEnvironment();
    const { scene } = await mount(exposed(0, sky({ energyMultiplier: ENERGY })));
    expect([scene.environmentIntensity, scene.backgroundIntensity]).toEqual([0, 0]);
  });

  it('reads a sky in a world with no CameraAttributes as before', async () => {
    built.next = skyEnvironment();
    const { scene } = await mount(
      <WorldExposureScope>{sky({ energyMultiplier: ENERGY })}</WorldExposureScope>
    );
    expect([scene.environmentIntensity, scene.backgroundIntensity]).toEqual([ENERGY * ENERGY, ENERGY]);
  });

  /**
   * Godot bakes a sky at the exposure of the render that finds it dirty, children first, and a sky
   * that reads lights is dirty in each render at another exposure (`sky.cpp:1085-1087`,
   * `:1105-1143`, `:1275`).
   */
  describe('drawn by viewports at other exposures', () => {
    const camera = new THREE.PerspectiveCamera();
    /** A render of `scene` at `exposure`, and the ambient energy it reads. */
    const ambientDrawnAt = (scene: THREE.Scene, exposure: number) =>
      drawAtExposure(scene, exposure, () => {
        fireSceneRender(scene, camera);
        return scene.environmentIntensity;
      });
    const skyLight = (
      <directionalLight userData={skyLightUserData({ drawsInSky: true, energy: 2, size: 0 })} />
    );

    it('keeps the bake of the first render for a sky that reads no lights', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      ambientDrawnAt(scene, 4);

      expect(ambientDrawnAt(scene, 3)).toBeCloseTo(ENERGY * ENERGY * 4 * 3, 10);
    });

    it("reads the first render's bake in the view that draws after it", async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      ambientDrawnAt(scene, 4);
      fireSceneRender(scene, camera);

      expect(scene.environmentIntensity).toBeCloseTo(ENERGY * ENERGY * 4 * 2, 10);
    });

    it('keeps the bake of the first render for a sky that reads lights but has none (edge case)', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(exposed(2, sky({ sky: proceduralSky, energyMultiplier: ENERGY })));
      ambientDrawnAt(scene, 4);

      expect(ambientDrawnAt(scene, 3)).toBeCloseTo(ENERGY * ENERGY * 4 * 3, 10);
    });

    it('keeps the first bake of a sky that reads lights while it still filters its layers', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(
        exposed(
          2,
          <>
            {sky({ sky: proceduralSky, energyMultiplier: ENERGY })}
            {skyLight}
          </>
        )
      );
      ambientDrawnAt(scene, 4);

      expect(ambientDrawnAt(scene, 3)).toBeCloseTo(ENERGY * ENERGY * 4 * 3, 10);
    });

    it('bakes a quality sky that reads lights again at the exposure of each render', async () => {
      built.next = skyEnvironment();
      const qualitySky: Sky = { ...proceduralSky, processMode: 'quality' };
      const { scene, advanceFrames } = await mount(
        exposed(
          2,
          <>
            {sky({ sky: qualitySky, energyMultiplier: ENERGY })}
            {skyLight}
          </>
        )
      );
      ambientDrawnAt(scene, 4);
      ambientDrawnAt(scene, 3);
      await advanceFrames(1);

      expect(bakes.map((bake) => bake.lights[0]?.energy)).toContain(6);
      expect(ambientDrawnAt(scene, 3)).toBeCloseTo(ENERGY * ENERGY * 3 * 3, 10);
    });

    it('keeps the first bake of a quality sky that reads no lights', async () => {
      built.next = skyEnvironment();
      const { scene } = await mount(
        exposed(2, sky({ sky: { ...panoramaSky, processMode: 'quality' }, energyMultiplier: ENERGY }))
      );
      ambientDrawnAt(scene, 4);

      expect(ambientDrawnAt(scene, 3)).toBeCloseTo(ENERGY * ENERGY * 4 * 3, 10);
    });

    it('bakes a quality panorama again at each exposure while the fog scatters the sun', async () => {
      built.next = skyEnvironment();
      const qualitySky: Sky = { ...panoramaSky, processMode: 'quality' };
      const { scene } = await mount(
        exposed(
          2,
          <>
            {sky({ sky: qualitySky, energyMultiplier: ENERGY, fogScattersSun: true })}
            {skyLight}
          </>
        )
      );
      ambientDrawnAt(scene, 4);

      expect(ambientDrawnAt(scene, 3)).toBeCloseTo(ENERGY * ENERGY * 3 * 3, 10);
    });

    it("draws the background of a sky that reads lights from a bake at each render's exposure", async () => {
      built.next = skyEnvironment();
      const { scene, advanceFrames } = await mount(
        exposed(
          2,
          <>
            {sky({ sky: proceduralSky })}
            {skyLight}
          </>
        )
      );
      const backgroundDrawnAt = (exposure: number) =>
        drawAtExposure(scene, exposure, () => {
          fireSceneRender(scene, camera);
          return scene.background;
        });
      backgroundDrawnAt(4);
      backgroundDrawnAt(3);
      await advanceFrames(1);

      expect(backgroundDrawnAt(3)).not.toBe(backgroundDrawnAt(4));
    });

    it('takes the exposure of its first render again for a new sky material', async () => {
      built.next = skyEnvironment();
      const { scene, update } = await mount(exposed(2, sky({ energyMultiplier: ENERGY })));
      ambientDrawnAt(scene, 4);
      await update(
        exposed(
          2,
          sky({ sky: { ...panoramaSky, material: { ...panoramaSky.material } }, energyMultiplier: ENERGY })
        )
      );
      ambientDrawnAt(scene, 3);

      expect(ambientDrawnAt(scene, 5)).toBeCloseTo(ENERGY * ENERGY * 3 * 5, 10);
    });

    it('counts a bake that lands a frame late as a change of the world Environment, which a probe captures again', async () => {
      built.next = skyEnvironment();
      const { scene, advanceFrames } = await mount(
        exposed(
          2,
          <>
            <OwnEnvironment />
            {sky({ sky: proceduralSky })}
            {skyLight}
          </>
        )
      );
      const changes = ownEnvironmentChanges(scene);
      drawAtExposure(scene, 3, () => fireSceneRender(scene, camera));
      await advanceFrames(1);

      expect(ownEnvironmentChanges(scene)).toBeGreaterThan(changes);
    });
  });

  describe('shared by layers that draw one sky', () => {
    it('bakes one sky once for two scenes that draw it alike', async () => {
      built.next = skyEnvironment();
      const subScene = new THREE.Scene();
      await mount(
        <>
          {sky()}
          {createPortal(sky(), subScene)}
        </>
      );

      expect(bakes).toHaveLength(1);
    });

    it('keeps the bake while another layer still draws the sky', async () => {
      const dispose = vi.fn();
      built.next = skyEnvironment(dispose);
      const subScene = new THREE.Scene();
      const { update } = await mount(
        <>
          {sky()}
          {createPortal(sky(), subScene)}
        </>
      );
      await update(<>{sky()}</>);

      expect(dispose).not.toHaveBeenCalled();
    });

    it('bakes a sky that is not debanded once for two intensities', async () => {
      built.next = skyEnvironment();
      const subScene = new THREE.Scene();
      await mount(
        <>
          {sky({ energyMultiplier: 1 })}
          {createPortal(sky({ energyMultiplier: 2 }), subScene)}
        </>
      );

      expect(bakes).toHaveLength(1);
    });

    it('frees a bake that no render read in a frame after the one that baked it, as Godot keeps one radiance', async () => {
      const dispose = vi.fn();
      built.next = skyEnvironment(dispose);
      const camera = new THREE.PerspectiveCamera();
      const { scene, advanceFrames } = await mount(exposed(2, sky({ sky: proceduralSky })));
      fireSceneRender(scene, camera);
      drawAtExposure(scene, 3, () => fireSceneRender(scene, camera));
      await advanceFrames(1);
      for (const _frame of [1, 2]) {
        fireSceneRender(scene, camera);
        await advanceFrames(1);
      }

      expect(dispose).toHaveBeenCalledOnce();
    });

    it('bakes a sky that holds no exposure once for every exposure', async () => {
      built.next = skyEnvironment();
      const { scene, advanceFrames } = await mount(exposed(2, sky()));
      drawAtExposure(scene, 3, () => fireSceneRender(scene, new THREE.PerspectiveCamera()));
      await advanceFrames(1);

      expect(bakes).toHaveLength(1);
    });

    it('keeps its bakes when a new exposure runs its effect again', async () => {
      const dispose = vi.fn();
      built.next = skyEnvironment(dispose);
      const { update, advanceFrames } = await mount(exposed(2, sky()));
      await update(exposed(5, sky()));
      await advanceFrames(1);

      expect(bakes).toHaveLength(1);
      expect(dispose).not.toHaveBeenCalled();
    });
  });
});

/** Names the Environment of these tests the world's own, as a probe captures with. */
function OwnEnvironment() {
  useOwnEnvironment(ENVIRONMENT);
  return null;
}
