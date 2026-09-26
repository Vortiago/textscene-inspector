/**
 * Sky slice build (ADR-0031): renders decoded sky Data, the scene's directional
 * lights and a panorama texture into a cubemap, prefiltered into an IBL.
 * `skyUniforms.ts` and `skyShaders.ts` are internals: nothing outside the slice
 * reaches past `build.ts`.
 */

import * as THREE from 'three';
import type { SkyProperties } from './types';
import { warn } from '../../logger';
import { skyFragmentShader, SKY_VERTEX_SHADER } from './skyShaders';
import { skyUniforms, type SkyLight } from './skyUniforms';
import { applyTextureState } from '../textures/applyTextureState';
import { releaseBoundTexture } from '../materials/standardmaterial3d/textureBinding';

export type { SkyLight } from './skyUniforms';

/** Cube face resolution. 256 is ample for a gradient and cheap to prefilter. */
const CUBE_SIZE = 256;

/**
 * Godot's sky ambient is the sky's own radiance: it lights surfaces and is what
 * they reflect (`Environment.reflection_source` defaults to the background).
 * So one cube render feeds both `scene.background` and the PMREM-prefiltered
 * `scene.environment`.
 */
export interface SkyEnvironment {
  /** Sharp cubemap for `scene.background`. */
  background: THREE.Texture;
  /** PMREM-prefiltered radiance for `scene.environment`. */
  environment: THREE.Texture;
  dispose: () => void;
}

export interface SkyEnvironmentInput {
  sky: SkyProperties;
  lights: readonly SkyLight[];
  panorama?: THREE.Texture | null;
}

/**
 * The panorama as the sky shader samples it. `PANORAMA_SKY_FRAGMENT_SHADER`
 * wraps u with `fract(atan(...))`, so it states Repeat (ADR-0042). The result is
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
  { sky, lights, panorama }: SkyEnvironmentInput
): SkyEnvironment | null {
  const tiledPanorama = skyPanoramaTexture(panorama);
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: skyUniforms(sky, lights, tiledPanorama),
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: skyFragmentShader(sky),
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });

  const skyScene = new THREE.Scene();
  skyScene.add(new THREE.Mesh(geometry, material));

  const cubeTarget = new THREE.WebGLCubeRenderTarget(CUBE_SIZE, {
    type: THREE.HalfFloatType,
  });
  let pmrem: THREE.PMREMGenerator | null = null;
  let prefiltered: THREE.WebGLRenderTarget | null = null;

  try {
    // The cube camera sits at the origin inside the unit box, so each face
    // samples the same directions Godot's `EYEDIR` covers.
    new THREE.CubeCamera(0.1, 10, cubeTarget).update(gl, skyScene);

    pmrem = new THREE.PMREMGenerator(gl);
    prefiltered = pmrem.fromCubemap(cubeTarget.texture);
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    cubeTarget.dispose();
    prefiltered?.dispose();
    return null;
  } finally {
    // The sky scene renders once, so its mesh and panorama are freed here and
    // not held for the environment's lifetime.
    pmrem?.dispose();
    geometry.dispose();
    material.dispose();
    releaseBoundTexture(tiledPanorama);
  }

  return {
    background: cubeTarget.texture,
    environment: prefiltered.texture,
    dispose: () => {
      cubeTarget.dispose();
      prefiltered.dispose();
    },
  };
}
