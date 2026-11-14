/**
 * The binding table of the sky template: the three.js value behind each uniform of
 * `environment/sky.glsl` that the background pass reads, with the line of Godot's C++ that
 * writes it. `writeSkyBindings` writes them all from one `SkyScene`.
 */

import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import type { TranspiledSky } from './transpileSky.js';

/** A directional light as Godot hands it to the sky (`sky.cpp:1070-1098`). */
export interface SkyLight {
  /** The light's +Z axis in world space, `basis.xform(Vector3(0, 0, 1))`: away from where it shines. */
  readonly direction: THREE.Vector3;
  /** The energy, negative for a negative light. */
  readonly energy: number;
  /** The colour, linear. */
  readonly color: THREE.Color;
  /** The angular diameter in radians. */
  readonly size: number;
}

/** The environment's fog as the sky reads it (`sky.cpp:1216-1228`). */
export interface SkyFog {
  /** The fog light colour, linear. */
  readonly lightColor: THREE.Color;
  readonly lightEnergy: number;
  readonly sunScatter: number;
  readonly skyAffect: number;
  readonly aerialPerspective: number;
  readonly density: number;
}

/** What the sky background pass reads from a frame. */
export interface SkyScene {
  readonly camera: THREE.PerspectiveCamera;
  /** The environment's sky rotation, `environment_get_sky_orientation`, or none. */
  readonly skyOrientation?: THREE.Matrix3;
  /** The shader time in seconds, `TIME`. */
  readonly time: number;
  /** The environment's background energy, `p_brightness_multiplier`. */
  readonly brightness: number;
  /** The environment's fog, or nothing when it is off. */
  readonly fog?: SkyFog;
  /** At most the four lights the sky reads (`sky.cpp:707`). */
  readonly lights: readonly SkyLight[];
}

/** The four lights of a sky's light buffer, `MAX_DIRECTIONAL_LIGHT_DATA_STRUCTS`. */
const SKY_LIGHTS = 4;

interface Binding {
  readonly uniform: string;
  /** Where Godot's C++ writes the value. */
  readonly godot: string;
  readonly value: (scene: SkyScene) => unknown;
}

/** Each uniform the background pass reads. The others hold zero, as they do for this pass. */
export const SKY_BINDINGS: readonly Binding[] = [
  { uniform: 'params.orientation', godot: 'sky.cpp:1501-1507, 237', value: orientationOf },
  { uniform: 'params.projection', godot: 'sky.cpp:224-227', value: projectionOf },
  {
    uniform: 'params.position',
    godot: 'sky.cpp:229-231',
    value: (scene) => scene.camera.getWorldPosition(new THREE.Vector3()),
  },
  { uniform: 'params.time', godot: 'sky.cpp:232', value: (scene) => scene.time },
  // 1 / the render buffers' luminance multiplier, which is 1 on the clustered renderer
  // (`render_forward_clustered.cpp:1978`).
  { uniform: 'params.luminance_multiplier', godot: 'sky.cpp:235', value: () => 1 },
  {
    uniform: 'params.brightness_multiplier',
    godot: 'render_forward_clustered.cpp:2045',
    value: (scene) => scene.brightness,
  },
  { uniform: 'sky_scene_data.fog_enabled', godot: 'sky.cpp:1216', value: (scene) => scene.fog !== undefined },
  { uniform: 'sky_scene_data.fog_density', godot: 'sky.cpp:1217', value: (scene) => scene.fog?.density ?? 0 },
  {
    uniform: 'sky_scene_data.fog_aerial_perspective',
    godot: 'sky.cpp:1218',
    value: (scene) => scene.fog?.aerialPerspective ?? 0,
  },
  { uniform: 'sky_scene_data.fog_light_color', godot: 'sky.cpp:1219-1223', value: fogLightOf },
  {
    uniform: 'sky_scene_data.fog_sun_scatter',
    godot: 'sky.cpp:1224',
    value: (scene) => scene.fog?.sunScatter ?? 0,
  },
  {
    uniform: 'sky_scene_data.fog_sky_affect',
    godot: 'sky.cpp:1226',
    value: (scene) => scene.fog?.skyAffect ?? 0,
  },
  {
    uniform: 'sky_scene_data.directional_light_count',
    godot: 'sky.cpp:1098',
    value: (scene) => Math.min(scene.lights.length, SKY_LIGHTS),
  },
  {
    uniform: 'directional_lights.data.direction_energy',
    godot: 'sky.cpp:1074-1086',
    value: (scene) =>
      lightSlots(scene, (light) => new THREE.Vector4(...light.direction.toArray(), light.energy)),
  },
  {
    uniform: 'directional_lights.data.color_size',
    godot: 'sky.cpp:1089-1097',
    value: (scene) =>
      lightSlots(
        scene,
        (light) => new THREE.Vector4(light.color.r, light.color.g, light.color.b, light.size)
      ),
  },
  {
    uniform: 'directional_lights.data.enabled',
    godot: 'sky.cpp:1094, 1112',
    value: (scene) => lightSlots(scene, () => true, false),
  },
];

/** Writes each uniform of `sky` the binding table names, from `scene`. */
export function writeSkyBindings(sky: TranspiledSky, scene: SkyScene): void {
  for (const binding of SKY_BINDINGS) {
    const node = sky.uniforms.get(binding.uniform) as
      (UniformNode<unknown> & { array?: unknown[] }) | undefined;
    if (!node) continue;
    const value = binding.value(scene);
    if (Array.isArray(value)) node.array!.splice(0, value.length, ...value);
    else node.value = value;
  }
}

/** The sky's basis: the inverse sky rotation, then the camera's (`sky.cpp:1501-1507`). */
function orientationOf(scene: SkyScene): THREE.Matrix3 {
  scene.camera.updateMatrixWorld();
  const camera = new THREE.Matrix3().setFromMatrix4(scene.camera.matrixWorld);
  const sky = scene.skyOrientation ? scene.skyOrientation.clone().invert() : new THREE.Matrix3();
  return sky.multiply(camera);
}

/**
 * The terms of the projection the template unprojects with, `columns[2][0]`, `columns[0][0]`,
 * `columns[2][1]` and `columns[1][1]`. three's matrix is column-major, as Godot's columns are.
 */
function projectionOf(scene: SkyScene): THREE.Vector4 {
  const columns = scene.camera.projectionMatrix.elements;
  return new THREE.Vector4(columns[8], columns[0], columns[9], columns[5]);
}

function fogLightOf(scene: SkyScene): THREE.Vector3 {
  const fog = scene.fog;
  if (!fog) return new THREE.Vector3();
  return new THREE.Vector3(fog.lightColor.r, fog.lightColor.g, fog.lightColor.b).multiplyScalar(
    fog.lightEnergy
  );
}

/** One value per light slot: the light's, then `empty` for each slot past the last light. */
function lightSlots<T>(scene: SkyScene, valueOf: (light: SkyLight) => T, empty?: T): T[] {
  return Array.from({ length: SKY_LIGHTS }, (_, index) => {
    const light = scene.lights[index];
    if (light) return valueOf(light);
    return empty ?? (new THREE.Vector4() as T);
  });
}
