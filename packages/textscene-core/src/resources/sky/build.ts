/**
 * Sky slice build (ADR-0031): renders decoded sky Data, the scene's directional
 * lights and a panorama texture into a cubemap, baked into Godot's radiance layers,
 * and builds the background that draws the same sky at each pixel.
 * `skyUniforms.ts` and `skyShaders.ts` are internals: nothing outside the slice
 * reaches past `build.ts`.
 */

import * as THREE from 'three';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import type { BuiltInSkyProperties, ShaderSkyProperties, Sky } from './types';
import { warn } from '../../logger';
import type { Vector3 } from '../../godot/math/vector';
import { skyFragmentShader, skyGlsl, SKY_VERTEX_SHADER } from './skyShaders';
import { skyUniforms, writeSkyLights, type SkyLight, type SkyUniforms } from './skyUniforms';
import { releaseView, textureView } from '../textures/textureView';
import { fillLiveCopy, isLiveTarget } from '../../r3f/liveTargets';
import { cubeRadiance, disposeSkyLayers, type SkyLayers } from './skyLayers';
import { cappedBake } from './radianceBake';
import { OctmapRadiance, type OctmapSky } from './octmapRadiance';
import { materialReadsLights } from './readsLights';
import type { SkyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { isDebanded } from './debanding';
import { godotTextureFilterState } from '../textures/godotTextureFilter';
import { TextureFilter } from '../../godot/rendering/materials/textureFilter';
import { SkyBackground, type SkyBackdrop } from '../../r3f/sky/skyBackground';

export type { SkyLight } from './skyUniforms';

/**
 * Godot's sky ambient is the sky's own radiance: it lights surfaces and is what
 * they reflect (`Environment.reflection_source` defaults to the background), and
 * the fogs read it too. So a cube render at the radiance size feeds Godot's layers
 * of it. The background draws the sky shader at each pixel, as Godot's does.
 */
export interface SkyEnvironment {
  /** The sky at each pixel behind the scene, or null for a sky that does not paint the background. */
  background: SkyBackdrop | null;
  /** Godot's radiance layers, which its ambient, its reflections and the fogs read. */
  layers: SkyLayers;
  /**
   * Fills the background's copy of the panorama's live target again, as Godot draws the background
   * from the sky shader each frame (`sky.cpp:1463`). Absent unless a pass draws the panorama and
   * the sky paints the background.
   */
  redrawBackground?: () => void;
  /** The bake of the layers in place, absent for a sky no render dirties after its build. */
  radianceInPlace?: RadianceInPlace;
  /** Shows `lights` to the background and to the next bake, absent for a sky that reads none. */
  setLights?: (lights: readonly SkyLight[]) => void;
  /** Frees the background, the panorama it samples, and the layers. */
  dispose: () => void;
}

/** Bakes the layers again into the array the readers sample, as for a dirty sky (`sky.cpp:1273`). */
export interface RadianceInPlace {
  /** Bakes every layer, as a real-time or a quality sky does. */
  bakeAgain(position: Readonly<Vector3>): void;
  /** Bakes layer 0 alone, as an incremental sky does: `filterLayer` then filters the others. */
  bakeFirstLayerAgain(position: Readonly<Vector3>): void;
  /** Filters `layer` from the last bake of layer 0. */
  filterLayer(layer: number): void;
}

export interface SkyEnvironmentInput {
  sky: Sky;
  lights: readonly SkyLight[];
  panorama?: THREE.Texture | null;
  /** Whether the sky paints the background. */
  asBackground: boolean;
  /** The scale a surface reads the radiance at, `scene.environmentIntensity`. */
  energy: number;
  /** A shader sky's loaded texture parameters, by uniform name. */
  textures?: Readonly<Record<string, SamplerValue>>;
  /** A shader sky's parse options: the project's rendering method, the varying slots, the decoders. */
  shaderOptions?: ProjectShaderOptions;
  /** The project's filter settings, for a shader sky's samplers and each surface's read of the layers. */
  sampling?: ProjectSampling;
  /** The sky transpiler's builder for a shader sky, imported on demand to keep it off the first paint. */
  buildShaderSky?: ShaderSkyBuilder;
}

/** Builds a shader sky's environment, as `buildSkyEnvironment` answers. */
export type ShaderSkyBuilder = (
  gl: THREE.WebGLRenderer,
  material: ShaderSkyProperties,
  input: SkyEnvironmentInput
) => SkyEnvironment | null;

/**
 * The panorama as the sky shader samples it: `filter_linear` or `filter_nearest` with no mipmaps
 * (`sky_material.cpp:498-505`). `PANORAMA_SKY` samples across the seam at u = 0 and 1, so it
 * states Repeat (ADR-0044). The result is a clone only when the arrival diverges, and `releaseView`
 * frees it only then. A live target's copy is filled now, since the bake samples it before the
 * target's next render. Returns null for a sky with no panorama.
 */
function skyPanoramaTexture(
  gl: THREE.WebGLRenderer,
  material: BuiltInSkyProperties,
  panorama?: THREE.Texture | null
): THREE.Texture | null {
  if (!panorama || material.kind !== 'panorama') return null;
  const view = textureView(panorama, {
    colorSpace: panorama.colorSpace as THREE.ColorSpace,
    wrap: THREE.RepeatWrapping,
    filter: godotTextureFilterState(material.filter ? TextureFilter.LINEAR : TextureFilter.NEAREST),
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
  input: SkyEnvironmentInput
): SkyEnvironment | null {
  const { material } = input.sky;
  if (material.kind !== 'shader') return buildBuiltInSkyEnvironment(gl, material, input);
  if (!input.buildShaderSky) throw new Error('expected the sky transpiler for a shader sky, got none');
  return input.buildShaderSky(gl, material, input);
}

/** The environment of a sky the previewer draws with its own GLSL. */
function buildBuiltInSkyEnvironment(
  gl: THREE.WebGLRenderer,
  material: BuiltInSkyProperties,
  { sky, lights, panorama, asBackground, energy, sampling }: SkyEnvironmentInput
): SkyEnvironment | null {
  const panoramaView = skyPanoramaTexture(gl, material, panorama);
  const uniforms = skyUniforms(material, lights, panoramaView);
  let background: SkyBackground | null = null;
  let radiance: OctmapRadiance;
  try {
    // Ahead of the bake, so a three whose background program moved frees no layers it baked.
    background = asBackground ? new SkyBackground(skyGlsl(material), uniforms) : null;
    const bake = cappedBake(sky);
    const octmapSky = new CubeSkyOctmap(material, uniforms, bake.radianceSize, radianceDebanding(material, energy));
    radiance = new OctmapRadiance(gl, bake, octmapSky, sampling);
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    background?.dispose();
    releaseView(panoramaView);
    return null;
  }

  // After the bake only the background samples the panorama.
  if (!background) releaseView(panoramaView);
  const disposeBackground = () => {
    if (!background) return;
    background.dispose();
    releaseView(panoramaView);
  };
  const redrawBackground =
    background && panorama && panoramaView && isLiveTarget(panorama)
      ? () => fillLiveCopy(panorama, panoramaView, gl)
      : undefined;
  // A built-in sky reads neither `TIME` nor `POSITION`, so only a change of its lights bakes it again.
  if (!materialReadsLights(material)) {
    const layers = radiance.releaseLayers();
    const dispose = () => {
      disposeBackground();
      disposeSkyLayers(layers);
    };
    return { background, layers, redrawBackground, dispose };
  }
  return {
    background,
    layers: radiance.layers,
    redrawBackground,
    radianceInPlace: radiance,
    setLights: (lights) => writeSkyLights(uniforms, lights),
    dispose: () => {
      disposeBackground();
      radiance.dispose();
    },
  };
}

/**
 * A built-in sky's octmap pass: the sky drawn into a cube as wide as the radiance size, which stands
 * for Godot's octmap of that size, twice as wide for a cube's texel density (`sky.cpp:1554-1557`).
 */
class CubeSkyOctmap implements OctmapSky {
  private readonly geometry = new THREE.BoxGeometry(2, 2, 2);
  private readonly shader: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly cube: THREE.WebGLCubeRenderTarget;

  /** `debanding` scales the radiance's debanding noise, 0 for none. */
  constructor(
    material: BuiltInSkyProperties,
    uniforms: SkyUniforms,
    radianceSize: number,
    private readonly debanding: number
  ) {
    this.cube = new THREE.WebGLCubeRenderTarget(radianceSize, { type: THREE.HalfFloatType });
    this.shader = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: skyFragmentShader(material),
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.shader));
  }

  draw(gl: THREE.WebGLRenderer, octmap: THREE.WebGLRenderTarget, layout: SkyOctmapLayout): void {
    // The cube camera sits at the origin, so each face samples the directions Godot's `EYEDIR` covers.
    new THREE.CubeCamera(0.1, 10, this.cube).update(gl, this.scene);
    cubeRadiance(gl, this.cube.texture, this.debanding)(octmap, layout);
  }

  keepRadiance(): void {}

  dispose(): void {
    this.geometry.dispose();
    this.shader.dispose();
    this.cube.dispose();
  }
}

/**
 * The scale of the debanding noise in a sky's radiance. Godot adds the noise after
 * `background_energy_multiplier` scales the sky (`sky.glsl:277`, `:313-315`), and a surface here
 * reads the radiance scaled by that energy, so the noise scales by its inverse. At energy 0 Godot's
 * surfaces still read the noise, which a read scaled by 0 cannot show.
 */
function radianceDebanding(material: BuiltInSkyProperties, energy: number): number {
  return isDebanded(material) && energy > 0 ? 1 / energy : 0;
}
