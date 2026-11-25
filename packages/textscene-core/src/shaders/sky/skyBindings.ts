import * as THREE from 'three';
import { fogLightColor, type EnvironmentFog } from '../pipeline/environmentFog.js';
import { skyDraws, type TranspiledSky } from './transpileSky.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import { RADIANCE_ENERGY } from '../template/radianceCalls.js';
import type { Vector3 } from '../../godot/math/vector.js';

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
export type SkyFog = Pick<
  EnvironmentFog,
  'lightColor' | 'lightEnergy' | 'sunScatter' | 'skyAffect' | 'aerialPerspective' | 'density'
>;

/** The environment's volumetric fog as the background reads it (`sky.cpp:1148-1165`, `:1227-1228`). */
export interface SkyVolumetricFog {
  /** Rows bottom first, as a GL pass writes them (`sky.glsl:150-158`). */
  readonly volume: THREE.Texture;
  /** 1 over the fog's length, or 1 for a fog of no length. */
  readonly inverseLength: number;
  /** 1 over the detail spread, or 1 for a spread of 0. */
  readonly inverseDetailSpread: number;
  readonly skyAffect: number;
  /** `rendering/environment/fog/use_legacy_blending`. */
  readonly isLegacyBlending: boolean;
}

/** What the sky background pass reads from a frame. */
export interface SkyScene {
  /** The camera of the render: the sky reads its projection and its world matrix. */
  readonly camera: THREE.Camera;
  /** `POSITION` when it is not the camera's origin, as in the octmap pass, which views from the origin. */
  readonly position?: Readonly<Vector3>;
  /** The environment's sky rotation, `environment_get_sky_orientation`, or none. */
  readonly skyOrientation?: THREE.Matrix3;
  /** The shader time in seconds, `TIME`. */
  readonly time: number;
  /** The environment's background energy, `p_brightness_multiplier`. */
  readonly brightness: number;
  /** `p_luminance_multiplier`, which also scales the debanding noise. None reads as 1, as on Forward+. */
  readonly luminance?: number;
  /** The environment's fog, or nothing when it is off. */
  readonly fog?: SkyFog;
  /** The environment's volumetric fog, or nothing when it is off. */
  readonly volumetricFog?: SkyVolumetricFog;
  /** At most the four lights the sky reads (`sky.cpp:707`). */
  readonly lights: readonly SkyLight[];
  /** The octmap's border size, 1 minus twice its padding in UV, for the octmap pass alone. */
  readonly borderSize?: number;
  /** The energy the bound radiance's layer 0 was baked at, which `RADIANCE` reads. None reads as 1. */
  readonly radianceEnergy?: number;
}

/** The four lights of a sky's light buffer, `MAX_DIRECTIONAL_LIGHT_DATA_STRUCTS`. */
const SKY_LIGHTS = 4;

/** Each uniform the background pass reads. The others hold zero, as they do for this pass. */
export const SKY_BINDINGS: readonly Binding<SkyScene>[] = [
  { uniform: 'params.orientation', godot: 'sky.cpp:1501-1507, 237', value: orientationOf },
  { uniform: 'params.projection', godot: 'sky.cpp:224-227, 1174', value: projectionOf },
  {
    uniform: 'params.position',
    godot: 'sky.cpp:229-231',
    value: ({ position, camera }) =>
      position
        ? new THREE.Vector3(position.x, position.y, position.z)
        : camera.getWorldPosition(new THREE.Vector3()),
  },
  { uniform: 'params.time', godot: 'sky.cpp:232', value: (scene) => scene.time },
  { uniform: 'params.border_size', godot: 'sky.cpp:233-234', value: borderSizeOf },
  { uniform: RADIANCE_ENERGY, godot: 'sky.glsl:277', value: ({ radianceEnergy = 1 }) => radianceEnergy },
  // 1 / the luminance multiplier, 1 on the clustered renderer (`render_forward_clustered.cpp:1978`).
  { uniform: 'params.luminance_multiplier', godot: 'sky.cpp:235', value: ({ luminance = 1 }) => luminance },
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
  {
    uniform: 'sky_scene_data.fog_light_color',
    godot: 'sky.cpp:1219-1223',
    value: (scene) => fogLightColor(scene.fog),
  },
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
    uniform: 'sky_scene_data.volumetric_fog_enabled',
    godot: 'sky.cpp:1148-1151',
    value: (scene) => scene.volumetricFog !== undefined,
  },
  {
    uniform: 'sky_scene_data.volumetric_fog_inv_length',
    godot: 'sky.cpp:1153-1158',
    value: (scene) => scene.volumetricFog?.inverseLength ?? 0,
  },
  {
    uniform: 'sky_scene_data.volumetric_fog_detail_spread',
    godot: 'sky.cpp:1160-1165',
    value: (scene) => scene.volumetricFog?.inverseDetailSpread ?? 0,
  },
  {
    uniform: 'sky_scene_data.volumetric_fog_sky_affect',
    godot: 'sky.cpp:1227',
    value: (scene) => scene.volumetricFog?.skyAffect ?? 0,
  },
  {
    uniform: 'sky_scene_data.fog_use_legacy_blending',
    godot: 'sky.cpp:1228',
    value: (scene) => scene.volumetricFog?.isLegacyBlending ?? false,
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

/** Writes each uniform the binding table names, and the fog's volume, from `scene`, in each pass of `sky`. */
export function writeSkyBindings(sky: TranspiledSky, scene: SkyScene): void {
  for (const draw of skyDraws(sky)) {
    writeBindings(SKY_BINDINGS, draw.uniforms, scene);
    const volume = draw.textures.get('volumetric_fog_texture');
    if (volume && scene.volumetricFog) volume.value = scene.volumetricFog.volume;
  }
}

/** The sky's basis: the inverse sky rotation, then the camera's (`sky.cpp:1501-1507`). */
function orientationOf(scene: SkyScene): THREE.Matrix3 {
  scene.camera.updateMatrixWorld();
  const camera = new THREE.Matrix3().setFromMatrix4(scene.camera.matrixWorld);
  const sky = scene.skyOrientation ? scene.skyOrientation.clone().invert() : new THREE.Matrix3();
  return sky.multiply(camera);
}

/** `columns[2][0]`, `[0][0]`, `[2][1]` and `[1][1]`, with `[1][1]` negated as the y-down uv needs. */
function projectionOf(scene: SkyScene): THREE.Vector4 {
  const columns = scene.camera.projectionMatrix.elements;
  // A frustum offset keeps its sign: Godot negates `[2][1]` for its own flip (`sky.cpp:1178-1181`).
  return new THREE.Vector4(columns[8], columns[0], columns[9], -columns[5]!);
}

/** Godot's `uv_border_size`, the padding of one side in UV, from a layout's width inside the padding. */
export function uvBorderSizeOf(borderSize: number): number {
  return (1 - borderSize) / 2;
}

/** The padding in UV, then 1 minus twice it, as `_render_sky` writes them from the padding. */
function borderSizeOf({ borderSize = 1 }: SkyScene): THREE.Vector2 {
  return new THREE.Vector2(uvBorderSizeOf(borderSize), borderSize);
}

/** One value per light slot: the light's, then `empty` for each slot past the last light. */
function lightSlots<T>(scene: SkyScene, valueOf: (light: SkyLight) => T, empty?: T): T[] {
  return Array.from({ length: SKY_LIGHTS }, (_, index) => {
    const light = scene.lights[index];
    if (light) return valueOf(light);
    return empty ?? (new THREE.Vector4() as T);
  });
}
