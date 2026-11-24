import * as THREE from 'three';
import type { NodeFrame } from 'three/webgpu';
import { depthCorrection } from '../../godot/math/projection.js';
import { transposed3x4 } from './instanceData.js';
import type { TranspiledSpatial } from './transpileSpatial.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import type { EnvironmentFog } from '../pipeline/environmentFog.js';
import { FOG_BINDINGS, FOG_SPECIALISATIONS, USE_FOG } from './fogBindings.js';
import { EFFECT_SPECIALISATIONS } from './effectSpecialisations.js';
import { DIRECTIONAL_LIGHT_BINDINGS, type DirectionalLight } from './directionalLights.js';

/** What the colour pass reads from a frame. */
export interface SpatialScene {
  readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /** The size of the viewport in pixels. */
  readonly width: number;
  readonly height: number;
  /** The shader time in seconds, `TIME`. */
  readonly time: number;
  /** The flat ambient light, linear and with its energy: the clear colour with no Environment. */
  readonly ambientLight: THREE.Color;
  /** The camera attributes' exposure factor, 1 with none (`render_scene_data_rd.cpp:239, 254`). */
  readonly emissiveExposure: number;
  /** The environment's fog, or nothing when it is off. */
  readonly fog?: EnvironmentFog;
  /** The directional lights that light surfaces, the ones Godot's cull draws. */
  readonly directionalLights: readonly DirectionalLight[];
}

/** A scene with its Godot projection and the inverse, which four bindings read, and the pass of the draw. */
export interface SpatialFrame extends SpatialScene {
  readonly projection: THREE.Matrix4;
  readonly inverseProjection: THREE.Matrix4;
  /** Whether the material draws in Godot's alpha pass, whose scene data has no roughness limiter. */
  readonly isAlphaPass: boolean;
}

/** `SCENE_DATA_FLAGS_USE_AMBIENT_LIGHT` (`scene_data_inc.glsl:6`). */
const USE_AMBIENT_LIGHT = 1 << 0;

/** `SCENE_DATA_FLAGS_USE_ROUGHNESS_LIMITER` (`scene_data_inc.glsl:9`), on by default in the opaque pass. */
const USE_ROUGHNESS_LIMITER = 1 << 3;

/** `Camera3D::layers`' default: the 20 visual layers. */
const ALL_VISUAL_LAYERS = 0xfffff;

/** The project's `screen_space_roughness_limiter` amount and limit defaults (`rendering_server.cpp`). */
const ROUGHNESS_LIMITER = { amount: 0.25, limit: 0.18 };

const DATA = 'scene_data_block.data';

/** The template's `scene_data.viewport_size`, which an emulated point's size is measured in. */
export const VIEWPORT_SIZE = `${DATA}.viewport_size`;

/** Each member of `SceneData` the colour pass of an unlit scene reads (`render_scene_data_rd.cpp:72-290`). */
export const SCENE_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: `${DATA}.projection_matrix`,
    godot: 'render_scene_data_rd.cpp:88',
    value: (frame) => frame.projection,
  },
  {
    uniform: `${DATA}.inv_projection_matrix`,
    godot: 'render_scene_data_rd.cpp:89',
    value: (frame) => frame.inverseProjection,
  },
  {
    uniform: `${DATA}.inv_view_matrix`,
    godot: 'render_scene_data_rd.cpp:90',
    value: (scene) => columnsOf(transposed3x4(scene.camera.matrixWorld)),
  },
  {
    uniform: `${DATA}.view_matrix`,
    godot: 'render_scene_data_rd.cpp:91',
    value: (scene) => columnsOf(transposed3x4(scene.camera.matrixWorldInverse)),
  },
  {
    uniform: `${DATA}.projection_matrix_view`,
    godot: 'render_scene_data_rd.cpp:100-101',
    value: (frame) => [frame.projection],
  },
  {
    uniform: `${DATA}.inv_projection_matrix_view`,
    godot: 'render_scene_data_rd.cpp:102',
    value: (frame) => [frame.inverseProjection],
  },
  {
    uniform: `${DATA}.main_cam_inv_view_matrix`,
    godot: 'render_scene_data_rd.cpp:110',
    value: (scene) => scene.camera.matrixWorld.clone(),
  },
  { uniform: `${DATA}.z_far`, godot: 'render_scene_data_rd.cpp:116', value: (scene) => scene.camera.far },
  { uniform: `${DATA}.z_near`, godot: 'render_scene_data_rd.cpp:117', value: (scene) => scene.camera.near },
  {
    uniform: `${DATA}.camera_visible_layers`,
    godot: 'render_scene_data_rd.cpp:127',
    value: () => ALL_VISUAL_LAYERS,
  },
  // The opaque pass applies no alpha multiplier without motion vectors (`render_forward_clustered.cpp:2162`).
  { uniform: `${DATA}.pass_alpha_multiplier`, godot: 'render_scene_data_rd.cpp:128', value: () => 1 },
  {
    uniform: VIEWPORT_SIZE,
    godot: 'render_scene_data_rd.cpp:130-131',
    value: (scene) => new THREE.Vector2(scene.width, scene.height),
  },
  {
    uniform: `${DATA}.screen_pixel_size`,
    godot: 'render_scene_data_rd.cpp:133-135',
    value: (scene) => new THREE.Vector2(1 / scene.width, 1 / scene.height),
  },
  { uniform: `${DATA}.time`, godot: 'render_scene_data_rd.cpp:149', value: (scene) => scene.time },
  {
    uniform: `${DATA}.flags`,
    godot: 'render_scene_data_rd.cpp:208, 228, 258-259; render_forward_clustered.cpp:2162, 2381',
    value: ({ fog, isAlphaPass }) =>
      USE_AMBIENT_LIGHT | (isAlphaPass ? 0 : USE_ROUGHNESS_LIMITER) | (fog ? USE_FOG : 0),
  },
  {
    uniform: `${DATA}.ambient_light_color_energy`,
    godot: 'render_scene_data_rd.cpp:174-185, 229-233',
    value: ({ ambientLight }) => new THREE.Vector4(ambientLight.r, ambientLight.g, ambientLight.b, 1),
  },
  {
    uniform: `${DATA}.emissive_exposure_normalization`,
    godot: 'render_scene_data_rd.cpp:239, 254',
    value: ({ emissiveExposure }) => emissiveExposure,
  },
  { uniform: `${DATA}.IBL_exposure_normalization`, godot: 'render_scene_data_rd.cpp:255', value: () => 1 },
  {
    uniform: `${DATA}.roughness_limiter_amount`,
    godot: 'render_scene_data_rd.cpp:261',
    value: () => ROUGHNESS_LIMITER.amount,
  },
  {
    uniform: `${DATA}.roughness_limiter_limit`,
    godot: 'render_scene_data_rd.cpp:262',
    value: () => ROUGHNESS_LIMITER.limit,
  },
];

/** Writes each uniform of `spatial` the binding table names, from `scene`. */
export function writeSpatialBindings(spatial: TranspiledSpatial, scene: SpatialScene): void {
  scene.camera.updateWorldMatrix(true, false);
  const projection = projectionOf(scene);
  const frame = {
    ...scene,
    projection,
    inverseProjection: projection.clone().invert(),
    isAlphaPass: spatial.material.transparent,
  };
  writeBindings(SCENE_BINDINGS, spatial.uniforms, frame);
  writeBindings(FOG_BINDINGS, spatial.uniforms, frame);
  writeBindings(DIRECTIONAL_LIGHT_BINDINGS, spatial.uniforms, frame);
}

/** Writes the specialisation constants of `spatial`, which pick the colour pass's program. */
export function specialiseSpatial(spatial: TranspiledSpatial, fog: EnvironmentFog | undefined): void {
  writeBindings(FOG_SPECIALISATIONS, spatial.specialisations, { fog });
  writeBindings(EFFECT_SPECIALISATIONS, spatial.specialisations, undefined);
}

/** The uniform every vertex stage of the scene template reads, so its object update runs before each draw. */
const DRAW_HOOK = `${DATA}.projection_matrix`;

/** One draw of a transpiled material: its render, camera, scene, object and the material drawing it. */
export interface SpatialDraw {
  /** Counts the renders of the renderer's node handler, so a draw tells a new render from its own. */
  readonly renderId: number;
  readonly camera: THREE.Camera;
  readonly scene: THREE.Scene;
  readonly object: THREE.Object3D;
  readonly material: THREE.Material;
}

/** Runs `draw` before each draw of the material or its depth materials. */
export function beforeEachDraw(spatial: TranspiledSpatial, draw: (drawn: SpatialDraw) => void): void {
  const hook = spatial.uniforms.get(DRAW_HOOK);
  if (!hook || !('onObjectUpdate' in hook))
    throw new Error(
      `expected the scene template to read the uniform ${DRAW_HOOK}, found ${hook ? 'an array' : 'none'}`
    );
  // `renderId`, not `frameId`: a probe capture and the view it lights draw in one frame, with other lights.
  hook.onObjectUpdate(({ renderId, camera, scene, object, material }: NodeFrame) =>
    draw({ renderId, camera: camera!, scene: scene!, object: object!, material: material! })
  );
}

/** The camera's projection with y flipped and depth reversed into 0 to 1. */
function projectionOf(scene: SpatialScene): THREE.Matrix4 {
  return new THREE.Matrix4().fromArray(depthCorrection(true)).multiply(scene.camera.projectionMatrix);
}

/** A matrix whose first three columns are `values`, four at a time, and whose last column is zero. */
function columnsOf(values: readonly number[]): THREE.Matrix4 {
  return new THREE.Matrix4().fromArray([...values, 0, 0, 0, 0]);
}
