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
import { applyTextureState } from '../textures/applyTextureState';
import { releaseBoundTexture } from '../materials/standardmaterial3d/textureBinding';
import { bakeSkyLayers, disposeSkyLayers, type SkyLayers } from './skyLayers';

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
 * So a cube render at the radiance size feeds the PMREM-prefiltered
 * `scene.environment` and Godot's layers 1 to 7 of it. A sky that paints the
 * background renders a cube for `scene.background` too, the same cube when the
 * sizes match.
 */
export interface SkyEnvironment {
  /** Sharp cubemap for `scene.background`, or null for a sky that does not paint it. */
  background: THREE.Texture | null;
  /** PMREM-prefiltered radiance for `scene.environment`, whose mip 0 a mirror reflects. */
  environment: THREE.Texture;
  /** Godot's layers 1 to 7, which its ambient and its reflections read. */
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
}

/**
 * The panorama as the sky shader samples it. `PANORAMA_SKY_FRAGMENT_SHADER`
 * wraps u with `fract(atan(...))`, so it states Repeat (ADR-0044). The result is
 * a clone only when the arrival diverges, and `releaseBoundTexture` frees it
 * only then. Returns null for a sky with no panorama.
 */
export function skyPanoramaTexture(panorama?: THREE.Texture | null): THREE.Texture | null {
  if (!panorama) return null;
  return applyTextureState(panorama, {
    colorSpace: panorama.colorSpace as THREE.ColorSpace,
    repeat: true,
  });
}

/**
 * Null when the sky cannot render: a headless test renderer, a lost context, or
 * a driver that refuses the float render target. The caller then leaves the
 * background and environment alone, a visible absence rather than a wrong picture.
 */
export function buildSkyEnvironment(
  gl: THREE.WebGLRenderer,
  { sky, lights, panorama, asBackground }: SkyEnvironmentInput
): SkyEnvironment | null {
  const tiledPanorama = skyPanoramaTexture(panorama);
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: skyUniforms(sky.material, lights, tiledPanorama),
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
    layers = bakeSkyLayers(gl, radianceTarget.texture, bake);

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
    releaseBoundTexture(tiledPanorama);
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
