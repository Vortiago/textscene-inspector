/**
 * Readies the fog for one render of a scene: the depth fog's terms for its camera, the directional
 * lights its sun scatter reads, the sky's rotation and radiance, and the volumetric fog's volume.
 * `finishFog` clears them after that render, so a scene without fog draws none.
 */

import * as THREE from 'three';
import { renderedDepthFogRange } from '../../godot/depthFog.js';
import type { VolumetricFogProjectSettings } from '../../godot/volumetricFog.js';
import type { EnvironmentSettings } from '../../resources/environment/types.js';
import { godotColorToLinear } from '../godotColor.js';
import { readSkyLightDeclaration } from '../sky/skyLight.js';
import { visibleInTree } from '../visibleInTree.js';
import type { FogPasses } from './fogPasses.js';
import { skyRadiance } from './fogSky.js';
import { FOG_SUN_MAX, fogUniforms } from './fogUniforms.js';
import type { VolumetricFog } from './fogVolumePass.js';

export type DepthFog = NonNullable<EnvironmentSettings['fog']>;

export interface FogSettings {
  depth: DepthFog | null;
  volumetric: VolumetricFog | null;
  project: VolumetricFogProjectSettings;
  /** World to sky space. */
  worldToSky: THREE.Matrix3;
  /** The sky's energy, which Godot's radiance carries and three's does not. */
  skyEnergy: number;
}

/** Scratch for one light, overwritten by each. */
const from = new THREE.Vector3();
const towards = new THREE.Vector3();

/**
 * Writes the fog's uniforms for a render of `scene` through `camera`, and draws what they sample.
 * Answers whether the volume is still settling, when the next frame redraws it.
 */
export function prepareFog(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  settings: FogSettings,
  passes: FogPasses,
  lights: readonly THREE.Light[]
): boolean {
  fogUniforms.skyRotation.set(settings.worldToSky.elements);
  writeDepthFog(settings.depth, camera);
  writeSuns(lights);
  if (settings.depth && settings.depth.aerialPerspective > 0) {
    passes.radiance.bake(renderer, skyRadiance(scene), settings.skyEnergy);
  }
  if (!settings.volumetric) return false;
  return passes.volume.prepare(renderer, scene, camera, {
    fog: settings.volumetric,
    project: settings.project,
    worldToSky: settings.worldToSky,
    skyEnergy: settings.skyEnergy,
    lights,
  });
}

/** Leaves later renders, of this scene or another, without fog. */
export function finishFog(): void {
  fogUniforms.depthColor[3] = 0;
  fogUniforms.volumeLookup[0] = 0;
}

/** The depth fog's terms (`storage_rd/render_scene_data_rd.cpp:208-225`), off when `fog` is null. */
function writeDepthFog(fog: DepthFog | null, camera: THREE.Camera): void {
  if (!fog) {
    fogUniforms.depthColor[3] = 0;
    return;
  }
  const color = godotColorToLinear(fog.color).multiplyScalar(fog.lightEnergy);
  const { near, far } = camera as THREE.PerspectiveCamera;
  const range = renderedDepthFogRange({ begin: fog.depthBegin, end: fog.depthEnd }, far);
  fogUniforms.depthColor.set([color.r, color.g, color.b, 1]);
  fogUniforms.depthShape.set([fog.density, range.begin, range.end, fog.depthCurve]);
  fogUniforms.depthLayer.set([fog.mode, fog.height, fog.heightDensity, fog.aerialPerspective]);
  fogUniforms.depthSky.set([fog.skyAffect, fog.sunScatter, near, far]);
}

/**
 * Each visible directional light's direction towards it, and its colour times its energy as the
 * surfaces and the sky read it. Godot's surfaces skip a Sky Only light, which has no three
 * intensity, and its sky skips a Light Only one (`light_storage.cpp:631`, `sky.cpp:1069`).
 */
function writeSuns(lights: readonly THREE.Light[]): void {
  const { sunDirections, sunSurfaceColors, sunSkyColors } = fogUniforms;
  sunSurfaceColors.fill(0);
  sunSkyColors.fill(0);
  let slot = 0;
  for (const light of lights) {
    if (slot === FOG_SUN_MAX) break;
    if (!(light as THREE.DirectionalLight).isDirectionalLight || !visibleInTree(light)) continue;
    const sun = light as THREE.DirectionalLight;
    from.setFromMatrixPosition(sun.matrixWorld);
    towards.setFromMatrixPosition(sun.target.matrixWorld).sub(from).normalize().negate();
    const offset = slot * 4;
    sunDirections.set([towards.x, towards.y, towards.z, 0], offset);
    const { r, g, b } = sun.color;
    sunSurfaceColors.set([r * sun.intensity, g * sun.intensity, b * sun.intensity, 1], offset);
    // three's intensity is Godot's energy times PI, and so is the sky's sun once its shader adds PI.
    const sky = readSkyLightDeclaration(sun);
    const skyIntensity = sky ? (sky.drawsInSky ? sky.energy * Math.PI : 0) : sun.intensity;
    if (skyIntensity !== 0)
      sunSkyColors.set([r * skyIntensity, g * skyIntensity, b * skyIntensity, 1], offset);
    slot++;
  }
}
