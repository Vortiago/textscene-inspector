/**
 * Readies the fog for one render of a scene: the depth fog's terms for its camera, the directional
 * lights its sun scatter reads, and the volumetric fog's volume. Both fogs read the sky that
 * `<SkyLayer>` shows (`../sky/skyRadiance.ts`).
 * `finishFog` clears them after that render, so a scene without fog draws none.
 */

import * as THREE from 'three';
import { renderedDepthFogRange } from '../../godot/rendering/environment/depthFog.js';
import type { VolumetricFogProjectSettings } from '../../godot/rendering/environment/volumetricFog.js';
import type { DepthFog, VolumetricFog } from '../../resources/environment/types.js';
import { setGodotColorLinear } from '../godotColor.js';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants.js';
import { skyLightEnergy } from '../sky/skyLight.js';
import { visibleInTree } from '../visibleInTree.js';
import type { VolumetricFogPass } from './volumetricFogPass.js';
import { shineDirection } from './fogLights.js';
import type { FogVolumeObject } from './fogVolumeObject.js';
import { fogUniforms } from './fogUniforms.js';
import { MAX_DIRECTIONAL_LIGHTS } from '../../godot/rendering/lights/directionalShadow.js';
import { writeVec4 } from '../writeVec4.js';

export interface FogSettings {
  depth: DepthFog | null;
  volumetric: VolumetricFog | null;
  project: VolumetricFogProjectSettings;
}

/**
 * The fog a reflection probe capture draws: an exterior probe's depth fog, and no volumetric fog, as
 * a capture's buffers hold no fog volume (`render_forward_clustered.cpp:1680-1684`, `:1646-1650`). An
 * interior probe draws without the environment, so without its fog.
 */
export function captureFog(settings: FogSettings, isInterior: boolean): FogSettings {
  return { ...settings, depth: isInterior ? null : settings.depth, volumetric: null };
}

/** The objects of a scene the fog reads: its lights, the meshes that may cast their shadows, and its FogVolumes. */
interface FogObjects {
  lights: readonly THREE.Light[];
  casters: readonly THREE.Mesh[];
  volumes: readonly FogVolumeObject[];
}

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
  pass: VolumetricFogPass,
  { lights, casters, volumes }: FogObjects
): boolean {
  writeDepthFog(settings.depth, camera);
  writeSuns(lights);
  if (!settings.volumetric) return false;
  return pass.prepare(renderer, scene, camera, {
    fog: settings.volumetric,
    project: settings.project,
    lights,
    casters,
    volumes,
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
  const color = setGodotColorLinear(depthColor, fog.color).multiplyScalar(fog.lightEnergy);
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
    if (slot === MAX_DIRECTIONAL_LIGHTS) break;
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
