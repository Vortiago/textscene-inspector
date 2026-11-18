/**
 * `<SkyLayer>`: mounts a Godot sky as the scene's background and IBL, and shows its radiance to every
 * lit material and both fogs before each render of the scene, and black after it (`skyRadiance.ts`),
 * while its Environment is on the scene (`sceneEnvironment.tsx`).
 * Godot's sky shader draws the discs of the first four DirectionalLights that are not Light Only as
 * `LIGHT0..3`. The lights are read from the rendered three.js scene, where an instanced or GLB light
 * has its real world transform. The world's exposure and `background_energy_multiplier` scale the
 * sky as Godot does: the background and each disc once, and the ambient and the reflection twice,
 * since Godot bakes the radiance at both and a surface reads it at both again
 * (`render_forward_clustered.cpp:1993`, `render_scene_data_rd.cpp:169`, `:241-246`, `sky.cpp:1086`).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { visibleInTree } from '../visibleInTree';
import { useFrame, useThree } from '@react-three/fiber';
import type { AuthoredSky, Sky } from '../../resources/sky/types';
import type { RadianceInPlace, SkyLight } from '../../resources/sky/build';
import { NO_SKY_LIGHTS, noteSkyLights, skyLightEnergy, skyLightSize } from './skyLight';
import { skyEuler } from './skyRotation';
import { hideShownSky } from './skyRadiance';
import { holdSkyBakes, radianceUpdateOf, type SkyBakes, type SkyLightsRead, skyUpdatePlan } from './skyBakes';
import { materialReadsLights } from '../../resources/sky/readsLights';
import {
  noteSkyFrame,
  restartSkyClock,
  stepSkyRadiance,
  type SkyFrameReads,
  type SkyRender,
  type SkyRadianceStep,
} from '../../godot/rendering/environment/skyRadianceUpdate';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime';
import { renderUnderWay } from '../viewportRender/worldRender';
import { takeRealTimeCaptureRenders } from '../reflectionProbe/realTimeCaptures';
import { ENVIRONMENT_SWITCH } from './environmentSwitch';
import { observeSceneRenderEnd } from '../sceneRenderCamera';
import { useExposureFactor } from '../environment/worldExposure';
import { followSceneExposure, worldExposureOfScene } from '../exposure/sceneExposure';
import {
  noteEnvironmentChange,
  registerEnvironmentPart,
  useEnvironmentKey,
} from '../environment/sceneEnvironment';
import { debandSky } from './skyDebanding';
import { showSkyBackground } from './skyBackground';
import { useShaderSkyTextures } from './shaderSkyTextures';
import { useProjectShaderOptions } from '../projectShaderOptions';
import { useShaderSkyErrorReport } from './shaderSkyError';
import { useReadSky } from './readSky';
import { useSkyTranslator } from './skyTranspiler';
import { useShaderErrorReport } from '../contexts/ShaderErrorsContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { projectSampling } from '../../parser/projectSettingsParser';
import { isLiveTarget, liveTargetDrawCount } from '../liveTargets';
import { isDebanded } from '../../resources/sky/debanding';
import type { Vector3 } from '../../godot/math/vector';

interface SkyLayerProps {
  sky: AuthoredSky;
  /**
   * `background_energy_multiplier`, which scales the drawn background once and the radiance twice:
   * the bake holds it, and each surface reads the radiance at it again, whatever the ambient source.
   */
  energyMultiplier?: number;
  /**
   * `ambient_light_sky_contribution`: the sky's share of the ambient, 0 when the ambient
   * comes from elsewhere.
   */
  contribution?: number;
  /** Whether surfaces reflect this sky: false under a reflection source that gives them none. */
  reflects?: boolean;
  /**
   * Whether this sky also paints the background. Godot's ambient can come from
   * the sky while the background shows something else (`AmbientSource.SKY`
   * over a colour background).
   */
  asBackground?: boolean;
  /** `sky_rotation`, which turns the background and the light the sky gives. */
  rotation: Vector3;
  /** The texture a PanoramaSkyMaterial samples, null for any other sky. */
  panorama: THREE.Texture | null;
  /** Whether the fog scatters the sun, which reads the lights for any sky (`sky.cpp:1053`). */
  fogScattersSun?: boolean;
}

/** Godot's sky shader has four light slots. The other lights do not reach it. */
const LIGHT_SLOTS = 4;

/** Scratch for one render's camera origin. */
const cameraOrigin = new THREE.Vector3();

const NO_FRAME_READS: SkyFrameReads = { time: false, position: false };

/** Each radiance a render has stepped, written only by `stepRadiance` in `<SkyLayer>`. */
const steppedRadiances = new WeakSet<RadianceInPlace>();

/** Runs `step` on the radiance in place, with `POSITION` at `position`. */
function stepInPlace(inPlace: RadianceInPlace, step: SkyRadianceStep, position: Vector3): void {
  if (step.kind === 'filter') inPlace.filterLayer(step.layer);
  else if (step.kind === 'bake' && step.isFirstLayerOnly) inPlace.bakeFirstLayerAgain(position);
  else if (step.kind === 'bake') inPlace.bakeAgain(position);
}

/** What `material` reads that changes from render to render: a built-in sky reads neither. */
function frameReadsOf(material: Sky['material']): SkyFrameReads {
  return material.kind === 'shader' ? material.usage : NO_FRAME_READS;
}

export function SkyLayer({
  sky: authoredSky,
  energyMultiplier = 1,
  contribution = 1,
  reflects = true,
  asBackground = true,
  rotation,
  panorama,
  fogScattersSun = false,
}: SkyLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const exposure = useExposureFactor();
  const environment = useEnvironmentKey();

  const { lightsRead, areLightsRead } = useSkyLights(scene);
  const contextRestores = useContextRestores(gl);
  const { x: rotationX, y: rotationY, z: rotationZ } = rotation;
  // Refs, not effect dependencies: a new share or reflection source needs no new bake.
  const contributionRef = useRef(contribution);
  contributionRef.current = contribution;
  const reflectsRef = useRef(reflects);
  reflectsRef.current = reflects;

  const isPanoramaDrawn = useIsPanoramaDrawn(panorama);
  const shaderCode = authoredSky.material.kind === 'shader' ? authoredSky.material.code : null;
  const shaderOptions = useProjectShaderOptions(shaderCode);
  const { transpiler, isReady: isTranslatorReady, loadFailure } = useSkyTranslator(gl, shaderCode !== null);
  useShaderErrorReport(loadFailure);
  const sky = useReadSky(authoredSky, transpiler, shaderOptions);
  const [textures, textureSlots] = useShaderSkyTextures(sky?.material ?? null);
  useShaderSkyErrorReport(sky?.material ?? null, transpiler, shaderOptions);
  const { settings } = useProjectSettings();
  const sampling = useMemo(() => projectSampling(settings), [settings]);

  // Written only by the effect below, while it holds bakes.
  const bakeWantedRef = useRef<(() => boolean) | null>(null);
  useFrame(({ invalidate }) => {
    if (bakeWantedRef.current?.()) invalidate();
  });

  useEffect(() => {
    // A bake before the first frame reads the lights would bake again unseen, at the cost of a whole bake.
    if (!areLightsRead || !lightsRead.current) return undefined;
    // A bake samples the panorama once, so it waits for the pass to draw a live target.
    if (!isPanoramaDrawn) return undefined;
    // A shader sky waits for the transpiler, the nodes handler, and its parse options with their decoders.
    if (!sky || !shaderOptions || !isTranslatorReady) return undefined;

    const lights = lightsRead.current;
    const skyRotation = skyEuler({ x: rotationX, y: rotationY, z: rotationZ });
    const input = {
      sky,
      lights,
      panorama,
      textures,
      shaderOptions,
      sampling,
      buildShaderSky: transpiler?.buildShaderSkyEnvironment,
      asBackground,
      energyMultiplier,
      rotation: skyRotation,
    };
    const { bakes, release } = holdSkyBakes(gl, input, contextRestores);
    const update = radianceUpdateOf(sky);
    const plan = skyUpdatePlan(sky, fogScattersSun);
    const readsLights = materialReadsLights(sky.material) || fogScattersSun;
    const first = bakes.bakeNow(update.baked?.exposure ?? exposure);
    if (!first) {
      release();
      return undefined;
    }
    let radiance = first;
    bakeWantedRef.current = bakeWantedOf(bakes, () => noteEnvironmentChange(scene, environment));

    // A render draws the background live at its own exposure. A surface reads the radiance at the
    // brightness that baked it, times its own exposure and its `background_energy_multiplier`
    // (`render_forward_clustered.cpp:2045`, `render_scene_data_rd.cpp:169`,
    // `scene_forward_clustered.glsl:1732`, `:1756`). A fog reads it without the multiplier (`:1121`).
    const renderAt = (drawn: number): SkyRender => ({
      exposure: drawn,
      brightness: energyMultiplier * drawn,
    });
    const showAt = (baked: SkyRender, render: SkyRender) => {
      radiance = bakes.at(baked.exposure) ?? radiance;
      scene.environmentIntensity = baked.brightness * render.brightness;
    };
    const frameReads = frameReadsOf(sky.material);
    const isFrameRead = frameReads.time || frameReads.position;
    const shaderTime = canvasShaderTime(gl);
    let seenJumps = shaderTime.jumps;
    const stepRadiance = (render: SkyRender, camera?: THREE.Camera) => {
      const read = lightsRead.current ?? lights;
      bakes.followLights(read);
      // The exposure scales the light data, and so dirties the sky, unless every energy is 0.
      const isExposed = readsLights && read.lights.some((light) => light.energy !== 0);
      const lightData = readsLights ? read.key : NO_SKY_LIGHTS;
      const isLightDirtied = noteSkyLights(gl, lightData, isExposed ? render.exposure : 1);
      if (shaderTime.jumps !== seenJumps) {
        seenJumps = shaderTime.jumps;
        restartSkyClock(update);
      }
      const isFrameDirtied =
        !!camera &&
        isFrameRead &&
        noteSkyFrame(update, frameReads, shaderTime.time, camera.getWorldPosition(cameraOrigin));
      const step = stepSkyRadiance(update, plan, render, isLightDirtied || isFrameDirtied);
      const inPlace = update.baked && bakes.inPlaceAt(update.baked.exposure);
      if (!inPlace) return;
      // The camera origin that last dirtied the sky: a replayed probe render has none of its own.
      const position = update.previousPosition;
      if (steppedRadiances.has(inPlace)) {
        stepInPlace(inPlace, step, position);
        return;
      }
      // A radiance no render has stepped holds the lights now read, and the `TIME` and origin of its build.
      steppedRadiances.add(inPlace);
      if (isFrameRead) inPlace.bakeAgain(position);
    };
    // Each view runs its render through the radiance update, the first of a frame after the faces
    // Godot draws for the ALWAYS probes at the world's exposure. A capture reads that bake and steps
    // nothing, as ours captures again only on change. An interior capture draws no sky.
    const showForRender = (drawn: number, camera: THREE.Camera) => {
      const render = renderAt(drawn);
      const capture = renderUnderWay()?.probeCapture;
      if (capture?.isInterior) return;
      if (!capture) {
        const captureRenders = takeRealTimeCaptureRenders(scene);
        const world = renderAt(worldExposureOfScene(scene) ?? 1);
        for (let replayed = 0; replayed < captureRenders; replayed += 1) stepRadiance(world);
        stepRadiance(render, camera);
      }
      const baked = update.baked ?? render;
      showAt(baked, render);
      // Only a background reads the bake at the drawn exposure: for a sky that paints none, the
      // read would bake that exposure to no use.
      if (asBackground) {
        (bakes.at(render.exposure) ?? radiance).background?.drawIn(scene, render.brightness, skyRotation);
      }
      radiance.radiance.show(contributionRef.current, reflectsRef.current, baked.brightness);
    };
    const stopRegistering = registerEnvironmentPart(scene, environment, () => {
      const previousEnvironment = scene.environment;
      const previousIntensity = scene.environmentIntensity;
      scene.environment = ENVIRONMENT_SWITCH;
      const stopShowingRadiance = followSceneExposure(scene, (drawn, camera) =>
        showForRender(drawn ?? 1, camera)
      );
      const stopHidingRadiance = observeSceneRenderEnd(scene, hideShownSky);
      const stopShowingBackground = asBackground ? showSkyBackground(scene) : undefined;
      showAt(update.baked ?? renderAt(exposure), renderAt(exposure));
      const stopDebanding = asBackground && isDebanded(sky.material) ? debandSky(gl, scene) : undefined;
      return () => {
        stopShowingRadiance();
        stopHidingRadiance();
        stopShowingBackground?.();
        stopDebanding?.();
        scene.environment = previousEnvironment;
        scene.environmentIntensity = previousIntensity;
      };
    });

    return () => {
      stopRegistering();
      bakeWantedRef.current = null;
      release();
    };
  }, [
    gl,
    scene,
    environment,
    sky,
    fogScattersSun,
    energyMultiplier,
    exposure,
    panorama,
    textures,
    shaderOptions,
    sampling,
    transpiler,
    isTranslatorReady,
    isPanoramaDrawn,
    asBackground,
    areLightsRead,
    lightsRead,
    contextRestores,
    rotationX,
    rotationY,
    rotationZ,
  ]);

  return <>{textureSlots}</>;
}

/**
 * Bakes each exposure a render of `bakes` asked for, after it redraws the backgrounds for a new draw
 * of a live panorama, and answers whether a frame should draw. A bake that lands, whichever layer
 * baked it, runs `noteBake`: a reflection probe captured the bake it replaces, and captures again
 * only for a change of its Environment (`sceneProbes.ts`).
 */
function bakeWantedOf(bakes: SkyBakes, noteBake: () => void): () => boolean {
  let seenCount = bakes.bakeCount;
  return () => {
    bakes.followPanorama();
    const isBaked = bakes.bakeWanted();
    if (bakes.bakeCount === seenCount) return isBaked;
    seenCount = bakes.bakeCount;
    noteBake();
    return true;
  };
}

/**
 * Whether `panorama` holds a picture a bake may sample: false for a live target until its pass first
 * draws it, read each frame until then, and true for any other texture or none.
 */
function useIsPanoramaDrawn(panorama: THREE.Texture | null): boolean {
  const isLive = !!panorama && isLiveTarget(panorama);
  const [drawnPanorama, setDrawnPanorama] = useState<THREE.Texture | null>(null);
  const isDrawn = !isLive || drawnPanorama === panorama;
  useFrame(() => {
    if (!isDrawn && panorama && liveTargetDrawCount(panorama) > 0) setDrawnPanorama(panorama);
  });
  return isDrawn;
}

/**
 * Counts the contexts `gl` restores. A lost context loses every texture the bake drew, and the bake
 * keeps nothing on the CPU to upload again, so the sky bakes again on each.
 */
function useContextRestores(gl: THREE.WebGLRenderer): number {
  const [restores, setRestores] = useState(0);
  useEffect(() => {
    const restored = () => setRestores((count) => count + 1);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => gl.domElement.removeEventListener('webglcontextrestored', restored);
  }, [gl]);
  return restores;
}

/** The lights the sky draws, read every frame as Godot reads them in each render (`sky.cpp:1059-1143`). */
function useSkyLights(scene: THREE.Scene): {
  lightsRead: React.RefObject<SkyLightsRead | null>;
  areLightsRead: boolean;
} {
  const lightsRead = useRef<SkyLightsRead | null>(null);
  const [areLightsRead, setAreLightsRead] = useState(false);
  useFrame(() => {
    const lights = directionalLights(scene);
    const key = skyLightsKey(lights);
    if (key === lightsRead.current?.key) return;
    lightsRead.current = { lights, key };
    setAreLightsRead(true);
  });
  return { lightsRead, areLightsRead };
}

function skyLightsKey(lights: readonly SkyLight[]): string {
  return lights
    .map(({ direction: d, color: c, energy, size }) => [d.x, d.y, d.z, c.r, c.g, c.b, energy, size].join(','))
    .join(';');
}

/**
 * The scene's directional lights, as Godot's sky shader wants them: the
 * direction towards the light (where its disc appears), its colour, and its
 * energy. three's `DirectionalLight` shines from its own world position toward
 * its target's, so the sky direction is that vector reversed.
 */
function directionalLights(scene: THREE.Scene): SkyLight[] {
  const lights: SkyLight[] = [];
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();

  scene.traverse((object) => {
    if (lights.length >= LIGHT_SLOTS) return;
    if (!(object as THREE.DirectionalLight).isDirectionalLight) return;
    // `traverse` descends into hidden subtrees, which three skips when lighting.
    // Godot's sky sees only the render list, so a hidden light draws no disc.
    if (!visibleInTree(object)) return;
    const light = object as THREE.DirectionalLight;
    const energy = skyLightEnergy(light);
    if (energy === null) return;

    light.getWorldPosition(from);
    light.target.getWorldPosition(to);
    const direction = from.clone().sub(to);
    if (direction.lengthSq() === 0) direction.set(0, 1, 0);

    lights.push({
      direction: direction.normalize(),
      color: light.color.clone(),
      // `sky.cpp` sets `sky_light_data.energy` from LIGHT_PARAM_ENERGY with no PI,
      // unlike the scene shader.
      energy,
      size: skyLightSize(light),
    });
  });

  return lights;
}
