/**
 * Readies the fog for one render of a scene: the depth fog's terms for its camera, the directional
 * lights its sun scatter reads, the scene's sky rotation and radiance, and the volumetric fog's volume.
 * `finishFog` clears them after that render, so a scene without fog draws none.
 */

import * as THREE from 'three';
import { renderedDepthFogRange } from '../../godot/depthFog.js';
import type { VolumetricFogProjectSettings } from '../../godot/volumetricFog.js';
import type { EnvironmentSettings } from '../../resources/environment/types.js';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants.js';
import { skyLightEnergy } from '../sky/skyLight.js';
import { worldToSky } from '../sky/skyRotation.js';
import { visibleInTree } from '../visibleInTree.js';
import type { FogPasses } from './fogPasses.js';
import { shineDirection } from './fogLights.js';
import { skyRadiance } from './fogSky.js';
import { FOG_SUN_MAX, fogUniforms } from './fogUniforms.js';
import type { VolumetricFog } from './fogVolumePass.js';
import { writeVec4 } from './writeVec4.js';

export type DepthFog = NonNullable<EnvironmentSettings['fog']>;

export interface FogSettings {
  depth: DepthFog | null;
  volumetric: VolumetricFog | null;
  project: VolumetricFogProjectSettings;
  /** The sky's energy, which Godot's radiance carries and three's does not. */
  skyEnergy: number;
}

/** The objects of a scene the fog reads: its lights, and the meshes that may cast their shadows. */
export interface FogObjects {
  lights: readonly THREE.Light[];
  casters: readonly THREE.Mesh[];
}

/** World to sky space for the render being prepared. */
const toSky = new THREE.Matrix3();

/** Scratch for one render's depth fog colour. */
const depthColor = new THREE.Color();

/** Scratch for one light, overwritten by each. */
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
  { lights, casters }: FogObjects
): boolean {
  fogUniforms.skyRotation.set(worldToSky(scene.environmentRotation, toSky).elements);
  writeDepthFog(settings.depth, camera);
  writeSuns(lights);
  if (settings.depth && settings.depth.aerialPerspective > 0) {
    passes.radiance.bake(renderer, skyRadiance(scene), settings.skyEnergy);
  }
  if (!settings.volumetric) return false;
  return passes.volume.prepare(renderer, scene, camera, {
    fog: settings.volumetric,
    project: settings.project,
    worldToSky: toSky,
    skyEnergy: settings.skyEnergy,
    lights,
    casters,
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
  const color = depthColor
    .setRGB(fog.color.r, fog.color.g, fog.color.b, THREE.SRGBColorSpace)
    .multiplyScalar(fog.lightEnergy);
  const { near, far } = camera as THREE.PerspectiveCamera;
  const range = renderedDepthFogRange({ begin: fog.depthBegin, end: fog.depthEnd }, far);
  writeVec4(fogUniforms.depthColor, 0, color.r, color.g, color.b, 1);
  writeVec4(fogUniforms.depthShape, 0, fog.density, range.begin, range.end, fog.depthCurve);
  writeVec4(fogUniforms.depthLayer, 0, fog.mode, fog.height, fog.heightDensity, fog.aerialPerspective);
  writeVec4(fogUniforms.depthSky, 0, fog.skyAffect, fog.sunScatter, near, far);
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
    shineDirection(sun, towards).normalize().negate();
    writeVec4(sunDirections, slot, towards.x, towards.y, towards.z, 0);
    const { r, g, b } = sun.color;
    writeVec4(sunSurfaceColors, slot, r * sun.intensity, g * sun.intensity, b * sun.intensity, 1);
    // The sky's sun takes the intensity scale in its shader, as the surfaces' does in three.
    const skyIntensity = (skyLightEnergy(sun) ?? 0) * LIGHT_INTENSITY_SCALE;
    if (skyIntensity !== 0)
      writeVec4(sunSkyColors, slot, r * skyIntensity, g * skyIntensity, b * skyIntensity, 1);
    slot++;
  }
}
