/**
 * Sky slice build (ADR-0031): renders decoded sky Data, the scene's directional
 * lights and a panorama texture into a cubemap, prefiltered into an IBL.
 * `skyUniforms.ts` and `skyShaders.ts` are internals: nothing outside the slice
 * reaches past `build.ts`.
 */

import * as THREE from 'three';
import type { Sky, SkyBake } from './types';
import { warn } from '../../logger';
import { skyFragmentShader, SKY_VERTEX_SHADER } from './skyShaders';
import { skyUniforms, type SkyLight } from './skyUniforms';
import { releaseView, textureView } from '../textures/textureView';
import { fillEveryLiveCopy } from '../../r3f/liveTargets';
import { bakeSkyLayers, disposeSkyLayers, type SkyLayers } from './skyLayers';
import { isDebanded } from './debanding';

export type { SkyLight } from './skyUniforms';

/**
 * The background's cube face. Godot draws the background per pixel, and 256 is ample for a gradient.
 * It is also the radiance's cube at the default radiance size.
 */
const BACKGROUND_SIZE = 256;

/**
 * The largest radiance the previewer bakes, as each doubling costs four times the bake. Metal balls
 * from mirror to rough under a sky of radiance size 512 draw within 0.07/255 of Godot's at this cap.
 */
const LARGEST_RADIANCE_SIZE = 256;

/**
 * Godot's sky ambient is the sky's own radiance: it lights surfaces and is what
 * they reflect (`Environment.reflection_source` defaults to the background).
 * So a cube render at the radiance size feeds Godot's layers of it and the
 * PMREM-prefiltered `scene.environment`. A sky that paints the background renders
 * a cube for `scene.background` too, the same cube when the sizes match.
 */
export interface SkyEnvironment {
  /** Sharp cubemap for `scene.background`, or null for a sky that does not paint it. */
  background: THREE.Texture | null;
  /**
   * PMREM-prefiltered radiance for `scene.environment`, which turns three's environment lighting on
   * and which the volumetric fog reads. No surface reads it.
   */
  environment: THREE.Texture;
  /** Godot's radiance layers, which its ambient and its reflections read. */
  layers: SkyLayers;
  /** Frees the background, the environment and the layers. */
  dispose: () => void;
}

export interface SkyEnvironmentInput {
  sky: Sky;
  lights: readonly SkyLight[];
  panorama?: THREE.Texture | null;
  /** Whether the sky paints the background, which then needs a cube of its own size. */
  asBackground: boolean;
  /** The scale a surface reads the radiance at, `scene.environmentIntensity`. */
  energy: number;
}

/**
 * The panorama as the sky shader samples it. `PANORAMA_SKY_FRAGMENT_SHADER`
 * wraps u with `fract(atan(...))`, so it states Repeat (ADR-0044). The result is
 * a clone only when the arrival diverges, and `releaseView` frees it
 * only then. A live target's copy is filled now, since the bake samples it
 * before the target's next render. Returns null for a sky with no panorama.
 */
function skyPanoramaTexture(gl: THREE.WebGLRenderer, panorama?: THREE.Texture | null): THREE.Texture | null {
  if (!panorama) return null;
  const view = textureView(panorama, {
    colorSpace: panorama.colorSpace as THREE.ColorSpace,
    wrap: THREE.RepeatWrapping,
  });
  fillEveryLiveCopy(panorama, gl);
  return view;
}

/**
 * Null when the sky cannot render: a headless test renderer, a lost context, or
 * a driver that refuses the float render target. The caller then leaves the
 * background and environment alone, a visible absence rather than a wrong picture.
 */
export function buildSkyEnvironment(
  gl: THREE.WebGLRenderer,
  { sky, lights, panorama, asBackground, energy }: SkyEnvironmentInput
): SkyEnvironment | null {
  const panoramaView = skyPanoramaTexture(gl, panorama);
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: skyUniforms(sky.material, lights, panoramaView),
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: skyFragmentShader(sky.material),
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });

  const skyScene = new THREE.Scene();
  skyScene.add(new THREE.Mesh(geometry, material));

  const bake = cappedBake(sky);
  const backgroundTarget = asBackground ? cubeTarget(BACKGROUND_SIZE) : null;
  const radianceTarget =
    backgroundTarget && bake.radianceSize === BACKGROUND_SIZE
      ? backgroundTarget
      : cubeTarget(bake.radianceSize);
  const hasOwnRadianceCube = radianceTarget !== backgroundTarget;
  let pmrem: THREE.PMREMGenerator | null = null;
  let prefiltered: THREE.WebGLRenderTarget | null = null;
  let layers: SkyLayers | null = null;

  try {
    // The cube camera sits at the origin inside the unit box, so each face
    // samples the same directions Godot's `EYEDIR` covers.
    if (backgroundTarget) renderCube(gl, skyScene, backgroundTarget);
    if (hasOwnRadianceCube) renderCube(gl, skyScene, radianceTarget);
    layers = bakeSkyLayers(gl, radianceTarget.texture, bake, radianceDebanding(sky, energy));

    pmrem = new THREE.PMREMGenerator(gl);
    prefiltered = pmrem.fromCubemap(radianceTarget.texture);
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    backgroundTarget?.dispose();
    prefiltered?.dispose();
    if (layers) disposeSkyLayers(layers);
    return null;
  } finally {
    // The sky scene renders once, so its mesh and panorama are freed here and
    // not held for the environment's lifetime. A radiance cube of its own
    // has served the PMREM and the layers by now.
    if (hasOwnRadianceCube) radianceTarget.dispose();
    pmrem?.dispose();
    geometry.dispose();
    material.dispose();
    releaseView(panoramaView);
  }

  return {
    background: backgroundTarget?.texture ?? null,
    environment: prefiltered.texture,
    layers,
    dispose: () => {
      backgroundTarget?.dispose();
      prefiltered.dispose();
      disposeSkyLayers(layers);
    },
  };
}

/**
 * The scale of the debanding noise in a sky's radiance. Godot adds the noise after
 * `background_energy_multiplier` scales the sky (`sky.glsl:277`, `:313-315`), and a surface here
 * reads the radiance scaled by that energy, so the noise scales by its inverse. At energy 0 Godot's
 * surfaces still read the noise, which a read scaled by 0 cannot show.
 */
function radianceDebanding(sky: Sky, energy: number): number {
  return isDebanded(sky.material) && energy > 0 ? 1 / energy : 0;
}

/** The bake the previewer runs: an importance-sampled sky above `LARGEST_RADIANCE_SIZE` bakes at it. */
function cappedBake(bake: SkyBake): SkyBake {
  if (bake.radianceFilter === 'fast') return bake;
  return {
    radianceFilter: 'importance-sample',
    radianceSize: Math.min(bake.radianceSize, LARGEST_RADIANCE_SIZE),
  };
}

function cubeTarget(size: number): THREE.WebGLCubeRenderTarget {
  return new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
}

function renderCube(gl: THREE.WebGLRenderer, scene: THREE.Scene, target: THREE.WebGLCubeRenderTarget): void {
  new THREE.CubeCamera(0.1, 10, target).update(gl, scene);
}
