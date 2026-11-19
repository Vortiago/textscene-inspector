import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { COMMIT_FRAMES_AFTER_SETTLE } from '../../resources/ResourceLoaderContext';
import { heading } from '../../parser/testing/parserKit';
import { parseReflectionProbe } from '../../nodes/3d/reflectionprobe/parser';
import { testRenderer } from '../../testing/recordingWebGL';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { drawAsProbeCapture } from '../testing/worldRenders';
import { renderUnderWay } from '../viewportRender/worldRender';
import { mipmapBiasUniform } from '../testing/mipmapBiasUniform';
import type { ViewportShadowAtlas } from '../positionalShadow/viewportShadowAtlas';
import { ReflectionProbeObject } from './reflectionProbeObject';
import { noteRealTimeSkyState, takeRealTimeCaptureRenders } from './realTimeCaptures';
import { SceneProbes } from './sceneProbes';
import { rootViewportDescription } from '../viewportRender/viewportDescription';
import { shownProbes } from './probeSlots';
import { SCENE_ROW_TEXELS } from '../sceneRows/sceneRowTexels';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { drawAtExposure, useSceneExposure } from '../exposure/sceneExposure';
import { observeSceneCamera, observeSceneCull } from '../sceneRenderCamera';
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  DrawnEnvironment,
  registerEnvironmentPart,
  ShownEnvironment,
  useEnvironmentKey,
  useOwnEnvironment,
} from '../environment/sceneEnvironment';

const CLEAR = new THREE.Color(0.3, 0.3, 0.3);

/** A part that shows `color` as the background of the Environment around it. */
function BackgroundPart({ color }: { color: THREE.Color }) {
  const scene = useThree((state) => state.scene);
  const environment = useEnvironmentKey();
  useEffect(
    () =>
      registerEnvironmentPart(scene, environment, () => {
        const previous = scene.background;
        scene.background = color;
        return () => {
          scene.background = previous;
        };
      }),
    [scene, environment, color]
  );
  return null;
}

const WORLD_BACKGROUND = new THREE.Color('blue');
const CAMERA_BACKGROUND = new THREE.Color('red');

/** A view through a camera with an Environment of its own, over a world that holds another. */
function ViewedThroughCamera({ world = WORLD_BACKGROUND, camera = CAMERA_BACKGROUND }) {
  const worldEnvironment = useMemo(() => ({}), []);
  const cameraEnvironment = useMemo(() => ({}), []);
  useOwnEnvironment(worldEnvironment);
  return (
    <>
      <ShownEnvironment environment={cameraEnvironment}>
        <BackgroundPart color={camera} />
      </ShownEnvironment>
      <DrawnEnvironment environment={worldEnvironment}>
        <BackgroundPart color={world} />
      </DrawnEnvironment>
    </>
  );
}

/** A world that holds `factor` for its view and `world` for its own attributes. */
function Exposed({ factor, world = factor }: { factor: number; world?: number | null }) {
  useSceneExposure(factor, world);
  return null;
}

afterEach(() => {
  vi.restoreAllMocks();
  shownProbes.fill(0);
});

function probeObject(properties: Record<string, string> = {}, treeOrder = [0]): ReflectionProbeObject {
  const object = new ReflectionProbeObject();
  object.probe = parseReflectionProbe(heading('ReflectionProbe', { name: 'Probe' }), properties);
  object.treeOrder = treeOrder;
  return object;
}

async function sceneWith(...probes: ReflectionProbeObject[]) {
  return probesIn(new THREE.Scene(), ...probes);
}

async function probesIn(scene: THREE.Scene, ...probes: ReflectionProbeObject[]) {
  const { renderer } = await testRenderer();
  scene.add(...probes);
  scene.updateMatrixWorld();
  const sceneProbes = new SceneProbes(renderer, scene);
  const renders = vi.spyOn(renderer, 'render');
  const sceneRenders = () => renders.mock.calls.filter(([rendered]) => rendered === scene).length;
  /** The capture faces one `update` drew. */
  const facesDrawn = (pending = 0) => {
    const before = sceneRenders();
    sceneProbes.update(pending, CLEAR, rootViewportDescription(null));
    return sceneRenders() - before;
  };
  const settle = () => {
    for (let frame = 1; frame < COMMIT_FRAMES_AFTER_SETTLE; frame += 1) facesDrawn();
  };
  return { renderer, scene, sceneProbes, facesDrawn, settle };
}

/**
 * The exposure normalisation of the first probe in a render of `scene`, as the shader reads it: the
 * render's exposure in the shown slot over the captured one in the probe's row, 1 for a render
 * with no exposure (`probeShaderChunk.ts`).
 */
function shownNormalisation(renderer: THREE.WebGLRenderer, scene: THREE.Scene): number {
  fireSceneRender(scene, new THREE.PerspectiveCamera());
  const packs = vi.mocked(renderer.initTexture).mock.calls;
  const packed = packs[packs.length - 1]![0] as THREE.DataTexture;
  const rows = packed.image.data as Float32Array;
  const CAPTURED_EXPOSURE_TEXEL = 7;
  const exposure = shownProbes[3]!;
  return exposure < 0 ? 1 : exposure / rows[CAPTURED_EXPOSURE_TEXEL * 4]!;
}

describe('SceneProbes.update', () => {
  it('captures nothing while a resource is on its way, nor for a few frames after', async () => {
    const { facesDrawn } = await sceneWith(probeObject());

    expect(facesDrawn(1)).toBe(0);
    expect(Array.from({ length: COMMIT_FRAMES_AFTER_SETTLE - 1 }, () => facesDrawn())).not.toContain(6);
  });

  it("captures a probe's six faces once the scene settles", async () => {
    const { facesDrawn, settle } = await sceneWith(probeObject());
    settle();

    expect([facesDrawn(), facesDrawn()]).toEqual([6, 0]);
  });

  it('captures one ONCE probe a frame, as Godot captures one at a time', async () => {
    const { facesDrawn, settle } = await sceneWith(probeObject(), probeObject());
    settle();

    expect([facesDrawn(), facesDrawn(), facesDrawn()]).toEqual([6, 6, 0]);
  });

  it('captures the probes in reverse tree order, whatever order they mount in (renderer_scene_cull.cpp:531)', async () => {
    const second = probeObject({}, [1]);
    const first = probeObject({}, [0]);
    second.position.x = 1;
    const { renderer, facesDrawn, settle } = await sceneWith(first, second);
    settle();
    const renders = vi.spyOn(renderer, 'render');
    facesDrawn();

    expect((renders.mock.calls[0]![1] as THREE.Camera).position.x).toBeCloseTo(1, 6);
  });

  it('captures a probe again when it moves', async () => {
    const probe = probeObject();
    const { facesDrawn, settle } = await sceneWith(probe);
    settle();
    facesDrawn();

    probe.position.x = 3;
    probe.updateMatrixWorld();

    expect(facesDrawn()).toBe(6);
  });

  it('captures every probe again once new content settles (edge case)', async () => {
    const { facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();

    facesDrawn(1);
    settle();

    expect(facesDrawn()).toBe(6);
  });

  it('keeps its captures when the scene exposure changes, as Godot rescales them instead', async () => {
    const world = await ReactThreeTestRenderer.create(<Exposed factor={2} />);
    const { facesDrawn, settle } = await probesIn(world.scene.instance as THREE.Scene, probeObject());
    settle();
    facesDrawn();
    await world.update(<Exposed factor={3} />);

    expect(facesDrawn()).toBe(0);
  });

  it('keeps a capture while the scene exposure stays', async () => {
    const world = await ReactThreeTestRenderer.create(<Exposed factor={2} />);
    const { facesDrawn, settle } = await probesIn(world.scene.instance as THREE.Scene, probeObject());
    settle();
    facesDrawn();

    expect(facesDrawn()).toBe(0);
  });

  it('keeps showing a stale capture until its probe captures again (edge case)', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject(), probeObject());
    settle();
    facesDrawn();
    facesDrawn();

    facesDrawn(1);
    settle();
    facesDrawn();
    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(shownProbes[0]).toBe(2);
  });

  it('captures no hidden probe (edge case)', async () => {
    const probe = probeObject();
    probe.visible = false;
    const { facesDrawn, settle } = await sceneWith(probe);
    settle();

    expect(facesDrawn()).toBe(0);
  });
});

describe('SceneProbes ALWAYS renders', () => {
  it("counts the six faces of each ALWAYS probe for the sky's radiance update", async () => {
    const { scene, facesDrawn } = await sceneWith(probeObject({ update_mode: '1' }));
    facesDrawn();

    expect(takeRealTimeCaptureRenders(scene)).toBe(6);
  });

  it('captures every ALWAYS probe in a frame and one ONCE probe (renderer_scene_cull.cpp:3739-3763)', async () => {
    const always = () => probeObject({ update_mode: '1' });
    const { facesDrawn, settle } = await sceneWith(always(), probeObject(), always(), probeObject());
    settle();

    expect([facesDrawn(), facesDrawn()]).toEqual([3 * 6, 6]);
  });

  it('keeps an ALWAYS capture while the sky state its faces start from stays', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject({ update_mode: '1' }));
    noteRealTimeSkyState(scene, 'baked');
    settle();
    facesDrawn();
    noteRealTimeSkyState(scene, 'baked');

    expect(facesDrawn()).toBe(0);
  });

  it('captures an ALWAYS probe again once the sky state its faces start from changes', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject({ update_mode: '1' }));
    settle();
    facesDrawn();
    noteRealTimeSkyState(scene, 'x');

    expect(facesDrawn()).toBe(6);
  });

  it('keeps a ONCE capture when the sky state changes', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    noteRealTimeSkyState(scene, 'x');

    expect(facesDrawn()).toBe(0);
  });

  it('counts no interior ALWAYS probe, which draws no sky (render_forward_clustered.cpp:1819)', async () => {
    const { scene, facesDrawn } = await sceneWith(probeObject({ update_mode: '1', interior: 'true' }));
    facesDrawn();

    expect(takeRealTimeCaptureRenders(scene)).toBe(0);
  });
});

describe('SceneProbes rendering', () => {
  it("shows the captured probes, the atlas's border and its last layer to a render of the scene", async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject({ update_mode: '1' }));
    settle();
    facesDrawn();

    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(Array.from(shownProbes.subarray(0, 3))).toEqual([1, expect.closeTo(0.8, 6), 6]);
  });

  /** The scene rows' texture as the last render of the scene uploaded it. */
  function uploadedRows(uploads: { mock: { calls: unknown[][] } }): THREE.DataTexture {
    return uploads.mock.calls.at(-1)![0] as THREE.DataTexture;
  }

  it('uploads the rows when a capture changes them, not every render', async () => {
    const { renderer, scene, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    const uploads = vi.spyOn(renderer, 'initTexture');
    fireSceneRender(scene, new THREE.PerspectiveCamera());
    const { version } = uploadedRows(uploads);

    fireSceneRender(scene, new THREE.PerspectiveCamera());
    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(uploadedRows(uploads).version).toBe(version);
  });

  it('writes the rows of a second probe to the scene rows (edge case)', async () => {
    const { renderer, scene, facesDrawn, settle } = await sceneWith(
      probeObject({}, [0]),
      probeObject({}, [1])
    );
    settle();
    facesDrawn();
    facesDrawn();
    const uploads = vi.spyOn(renderer, 'initTexture');

    fireSceneRender(scene, new THREE.PerspectiveCamera());

    const data = uploadedRows(uploads).image.data as Float32Array;
    const atlasLayerOf = (row: number) => data[(row * SCENE_ROW_TEXELS + 6) * 4 + 3];
    expect([atlasLayerOf(0), atlasLayerOf(1)].sort()).toEqual([0, 1]);
  });

  it('stops showing a probe once it hides (edge case)', async () => {
    const hidden = probeObject();
    const { scene, facesDrawn, settle } = await sceneWith(probeObject(), hidden);
    settle();
    facesDrawn();
    facesDrawn();

    hidden.visible = false;
    facesDrawn();
    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(shownProbes[0]).toBe(1);
  });

  it('shows no probe to a capture, as Godot captures without them (edge case)', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    drawAsProbeCapture({ isInterior: false, hasShadows: true, isRealTime: false }, () =>
      fireSceneRender(scene, new THREE.PerspectiveCamera())
    );

    expect(shownProbes[0]).toBe(0);
  });

  it('shows no probe once the render ends, so another scene draws none', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    const camera = new THREE.PerspectiveCamera();
    fireSceneRender(scene, camera);

    fireSceneRenderEnd(scene, camera);

    expect(shownProbes[0]).toBe(0);
  });

  it("captures in the scene's own probe shadow atlas, not the viewport's (renderer_scene_cull.cpp:3691)", async () => {
    const { renderer, scene, facesDrawn, settle } = await sceneWith(probeObject());
    const atlases = new Set<ViewportShadowAtlas | null | undefined>();
    vi.spyOn(renderer, 'render').mockImplementation((rendered) => {
      if (rendered === scene) atlases.add(renderUnderWay()?.shadowAtlas);
    });
    settle();
    facesDrawn();
    const [atlas] = atlases;
    const light = new THREE.SpotLight();
    atlas?.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);

    expect([atlases.size, atlas?.slot(light)?.size]).toEqual([1, 256]);
  });

  it("captures at no mipmap bias, whatever the root's (render_forward_clustered.cpp:1824)", async () => {
    const { renderer, scene, sceneProbes, settle } = await sceneWith(probeObject());
    const biases = new Set<number>();
    vi.spyOn(renderer, 'render').mockImplementation((rendered) => {
      if (rendered === scene) biases.add(mipmapBiasUniform().value);
    });
    settle();

    sceneProbes.update(0, CLEAR, { ...rootViewportDescription(null), mipmapBias: -0.5 });

    expect([...biases]).toEqual([0]);
  });

  it('hides the shadows from a capture without enable_shadows, until its render ends', async () => {
    const { scene } = await sceneWith();
    const light = new THREE.DirectionalLight();
    light.shadow.intensity = 0.8;
    scene.add(light);
    const camera = new THREE.PerspectiveCamera();
    let during: number | null = null;

    drawAsProbeCapture({ isInterior: false, hasShadows: false, isRealTime: false }, () => {
      fireSceneRender(scene, camera);
      during = light.shadow.intensity;
      fireSceneRenderEnd(scene, camera);
    });

    expect([during, light.shadow.intensity]).toEqual([0, 0.8]);
  });
});

describe('SceneProbes exposure normalisation', () => {
  /** A scene exposed at `factor`, its probe captured, with the packing watched. */
  async function capturedAt(factor: number) {
    const world = await ReactThreeTestRenderer.create(<Exposed factor={factor} />);
    const probes = await probesIn(world.scene.instance as THREE.Scene, probeObject());
    vi.spyOn(probes.renderer, 'initTexture');
    probes.settle();
    probes.facesDrawn();
    return { ...probes, world };
  }

  it('is 1 while the exposure stays the one the probe captured at', async () => {
    const { renderer, scene } = await capturedAt(2);

    expect(shownNormalisation(renderer, scene)).toBe(1);
  });

  it('is the exposure over the one the probe captured at, after the exposure changes', async () => {
    const { renderer, scene, world, facesDrawn } = await capturedAt(2);
    await world.update(<Exposed factor={3} />);
    facesDrawn();

    expect(shownNormalisation(renderer, scene)).toBe(1.5);
  });

  it('is 1 once the scene holds no exposure, whatever the probe captured at', async () => {
    const { renderer, scene, world, facesDrawn } = await capturedAt(2);
    await world.update(<group />);
    facesDrawn();

    expect(shownNormalisation(renderer, scene)).toBe(1);
  });

  it('is the exposure over 1 for a probe captured before the scene held any (render_forward_clustered.cpp:1714)', async () => {
    const world = await ReactThreeTestRenderer.create(<group />);
    const { renderer, scene, facesDrawn, settle } = await probesIn(
      world.scene.instance as THREE.Scene,
      probeObject()
    );
    vi.spyOn(renderer, 'initTexture');
    settle();
    facesDrawn();
    await world.update(<Exposed factor={4} />);
    facesDrawn();

    expect(shownNormalisation(renderer, scene)).toBe(4);
  });

  describe('under a camera that exposes the view apart from the world', () => {
    /** The view at `view` and the world's own attributes at `world`, its probe captured, a point light of 8 in it. */
    async function capturedUnder(view: number, world: number | null) {
      const light = new THREE.PointLight(0xffffff, 8);
      const mounted = await ReactThreeTestRenderer.create(<Exposed factor={view} world={world} />);
      const probes = await probesIn(mounted.scene.instance as THREE.Scene, probeObject());
      (mounted.scene.instance as THREE.Scene).add(light);
      vi.spyOn(probes.renderer, 'initTexture');
      const lightAtRender: number[] = [];
      // A cull, which runs after the render has applied its exposure.
      observeSceneCull(mounted.scene.instance as THREE.Scene, () => lightAtRender.push(light.intensity));
      probes.settle();
      return { ...probes, lightAtRender, light };
    }

    it("captures at the world's exposure, not the camera's (render_forward_clustered.cpp:1714)", async () => {
      const { facesDrawn, lightAtRender } = await capturedUnder(4, 2);
      facesDrawn();

      expect(new Set(lightAtRender)).toEqual(new Set([16]));
    });

    it('puts the lights back after the capture', async () => {
      const { facesDrawn, light } = await capturedUnder(4, 2);
      facesDrawn();

      expect(light.intensity).toBe(8);
    });

    it("shows the capture at the camera's exposure over the world's it captured at (light_storage.cpp:1810)", async () => {
      const { renderer, scene, facesDrawn } = await capturedUnder(4, 2);
      facesDrawn();

      expect(shownNormalisation(renderer, scene)).toBe(2);
    });

    it('shows a world with no attributes of its own at the camera exposure over 1', async () => {
      const { renderer, scene, facesDrawn } = await capturedUnder(4, null);
      facesDrawn();

      expect(shownNormalisation(renderer, scene)).toBe(4);
    });

    it("captures while the camera exposes the view at 0, its lights at the world's exposure (edge case)", async () => {
      const { facesDrawn, lightAtRender } = await capturedUnder(0, 1);

      expect([facesDrawn(), new Set(lightAtRender)]).toEqual([6, new Set([8])]);
    });

    it('shows a probe in a pass at 1 over a held 0.5 at 1 over the exposure it captured at', async () => {
      const { renderer, scene, facesDrawn } = await capturedUnder(0.5, 2);
      facesDrawn();

      expect(drawAtExposure(scene, 1, () => shownNormalisation(renderer, scene))).toBe(0.5);
    });

    it('captures a view at 0 whose world holds 0 too', async () => {
      const { facesDrawn } = await capturedUnder(0, 0);

      expect(facesDrawn()).toBe(6);
    });
  });
});

describe('SceneProbes under a camera with an Environment of its own', () => {
  /** The view through the camera, its probe settled, and the background each render of it shows. */
  async function settledUnderCamera() {
    const mounted = await ReactThreeTestRenderer.create(<ViewedThroughCamera />);
    const scene = mounted.scene.instance as THREE.Scene;
    const probes = await probesIn(scene, probeObject());
    const backgroundAtRender: unknown[] = [];
    observeSceneCamera(scene, () => backgroundAtRender.push(scene.background));
    probes.settle();
    return { ...probes, mounted, backgroundAtRender };
  }

  it("captures with the world's own Environment, not the camera's (renderer_scene_cull.cpp:3692)", async () => {
    const { facesDrawn, backgroundAtRender } = await settledUnderCamera();
    facesDrawn();

    expect(new Set(backgroundAtRender)).toEqual(new Set([WORLD_BACKGROUND]));
  });

  it("puts the camera's Environment back after the capture", async () => {
    const { facesDrawn, scene } = await settledUnderCamera();
    facesDrawn();

    expect(scene.background).toBe(CAMERA_BACKGROUND);
  });

  it("captures again once a part of the world's own Environment changes", async () => {
    const { facesDrawn, mounted } = await settledUnderCamera();
    facesDrawn();
    await mounted.update(<ViewedThroughCamera world={new THREE.Color('green')} />);

    expect(facesDrawn()).toBe(6);
  });

  it("keeps its capture when only the camera's Environment changes", async () => {
    const { facesDrawn, mounted } = await settledUnderCamera();
    facesDrawn();
    await mounted.update(<ViewedThroughCamera camera={new THREE.Color('green')} />);

    expect(facesDrawn()).toBe(0);
  });
});
