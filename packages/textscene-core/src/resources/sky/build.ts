/**
 * Sky slice build (ADR-0031): renders decoded sky Data, the scene's directional
 * lights and a panorama texture into a cubemap, baked into Godot's radiance layers,
 * and builds the background that draws the same sky at each pixel.
 * `skyUniforms.ts` and `skyShaders.ts` are internals: nothing outside the slice
 * reaches past `build.ts`.
 */

import * as THREE from 'three';
import type { Sky, SkyBake } from './types';
import { warn } from '../../logger';
import { skyFragmentShader, skyGlsl, SKY_VERTEX_SHADER } from './skyShaders';
import { skyUniforms, type SkyLight, type SkyUniforms } from './skyUniforms';
import { releaseView, textureView } from '../textures/textureView';
import { fillLiveCopy } from '../../r3f/liveTargets';
import { bakeSkyLayers, disposeSkyLayers, type SkyLayers } from './skyLayers';
import { isDebanded } from './debanding';
import { godotTextureFilterState } from '../textures/godotTextureFilter';
import { TextureFilter } from '../../godot/rendering/materials/textureFilter';
import { SkyBackground } from '../../r3f/sky/skyBackground';

export type { SkyLight } from './skyUniforms';

/**
 * The largest radiance the previewer bakes, as each doubling costs four times the bake. Metal balls
 * from mirror to rough under a sky of radiance size 512 draw within 0.07/255 of Godot's at this cap.
 */
const LARGEST_RADIANCE_SIZE = 256;

/**
 * Godot's sky ambient is the sky's own radiance: it lights surfaces and is what
 * they reflect (`Environment.reflection_source` defaults to the background), and
 * the fogs read it too. So a cube render at the radiance size feeds Godot's layers
 * of it. The background draws the sky shader at each pixel, as Godot's does.
 */
export interface SkyEnvironment {
  /** The sky at each pixel behind the scene, or null for a sky that does not paint the background. */
  background: SkyBackground | null;
  /** Godot's radiance layers, which its ambient, its reflections and the fogs read. */
  layers: SkyLayers;
  /** Frees the background, the panorama it samples, and the layers. */
  dispose: () => void;
}

export interface SkyEnvironmentInput {
  sky: Sky;
  lights: readonly SkyLight[];
  panorama?: THREE.Texture | null;
  /** Whether the sky paints the background. */
  asBackground: boolean;
  /** The scale a surface reads the radiance at, `scene.environmentIntensity`. */
  energy: number;
}

/**
 * The panorama as the sky shader samples it: `filter_linear` or `filter_nearest` with no mipmaps
 * (`sky_material.cpp:498-505`). `PANORAMA_SKY_FRAGMENT_SHADER` wraps u across the seam, so it
 * states Repeat (ADR-0044). The result is a clone only when the arrival diverges, and `releaseView`
 * frees it only then. A live target's copy is filled now, since the bake samples it before the
 * target's next render. Returns null for a sky with no panorama.
 */
function skyPanoramaTexture(
  gl: THREE.WebGLRenderer,
  sky: Sky,
  panorama?: THREE.Texture | null
): THREE.Texture | null {
  if (!panorama || sky.material.kind !== 'panorama') return null;
  const view = textureView(panorama, {
    colorSpace: panorama.colorSpace as THREE.ColorSpace,
    wrap: THREE.RepeatWrapping,
    filter: godotTextureFilterState(sky.material.filter ? TextureFilter.LINEAR : TextureFilter.NEAREST),
  });
  fillLiveCopy(panorama, view, gl);
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
  const panoramaView = skyPanoramaTexture(gl, sky, panorama);
  const uniforms = skyUniforms(sky.material, lights, panoramaView);
  let layers: SkyLayers;
  try {
    layers = bakeRadiance(gl, sky, uniforms, energy);
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    releaseView(panoramaView);
    return null;
  }

  const freePanorama = () => releaseView(panoramaView);
  const background = asBackground ? new SkyBackground(skyGlsl(sky.material), uniforms, freePanorama) : null;
  return {
    background,
    layers,
    dispose: () => {
      if (background) background.dispose();
      else freePanorama();
      disposeSkyLayers(layers);
    },
  };
}

/** Renders `sky` into a cube at the radiance size and bakes Godot's layers from it. */
function bakeRadiance(gl: THREE.WebGLRenderer, sky: Sky, uniforms: SkyUniforms, energy: number): SkyLayers {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: skyFragmentShader(sky.material),
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const skyScene = new THREE.Scene();
  skyScene.add(new THREE.Mesh(geometry, material));
  const bake = cappedBake(sky);
  const radianceTarget = new THREE.WebGLCubeRenderTarget(bake.radianceSize, { type: THREE.HalfFloatType });
  try {
    // The cube camera sits at the origin inside the unit box, so each face
    // samples the same directions Godot's `EYEDIR` covers.
    new THREE.CubeCamera(0.1, 10, radianceTarget).update(gl, skyScene);
    return bakeSkyLayers(gl, radianceTarget.texture, bake, radianceDebanding(sky, energy));
  } finally {
    // The cube serves the layers once, so it and its sky mesh are freed here.
    radianceTarget.dispose();
    geometry.dispose();
    material.dispose();
  }
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
