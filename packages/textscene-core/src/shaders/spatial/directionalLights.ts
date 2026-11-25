import * as THREE from 'three';
import type { Binding } from '../uniforms/bindingTable.js';
import type { SpatialFrame } from './spatialBindings.js';

/** A DirectionalLight3D that lights surfaces (`light_storage.cpp:630-692`). */
export interface DirectionalLight {
  /** The light's +Z axis in world space: away from where it shines. */
  readonly direction: THREE.Vector3;
  /** `light_energy`, negative for a negative light. */
  readonly energy: number;
  /** `light_color`, linear. */
  readonly color: THREE.Color;
  readonly specular: number;
  /** `1 - cos(light_angular_distance)`, the angle as a cosine offset (`light_storage.cpp:671`). */
  readonly size: number;
  readonly cullMask: number;
  readonly bakeMode: number;
  readonly volumetricFogEnergy: number;
}

/** `MAX_DIRECTIONAL_LIGHT_DATA_STRUCTS`, the project's `max_directional_lights` default. */
const MAX_DIRECTIONAL_LIGHTS = 8;

const LIGHTS = 'directional_lights.data';

/** The value of an empty slot, read only, so a light that leaves holds no stale row. */
const NO_DIRECTION: Readonly<THREE.Vector3> = new THREE.Vector3();
const NO_COLOR: Readonly<THREE.Color> = new THREE.Color(0, 0, 0);

/** One member of every light's row, refilled in place on each draw, so a draw allocates no array. */
function lightMember<T>(
  member: string,
  godot: string,
  valueOf: (light: DirectionalLight, slot: number, frame: SpatialFrame) => T,
  empty: T
): Binding<SpatialFrame> {
  const slots = new Array<T>(MAX_DIRECTIONAL_LIGHTS);
  return {
    uniform: `${LIGHTS}.${member}`,
    godot,
    value: (frame) => {
      for (let slot = 0; slot < MAX_DIRECTIONAL_LIGHTS; slot++) {
        const light = frame.directionalLights[slot];
        slots[slot] = light ? valueOf(light, slot, frame) : empty;
      }
      return slots;
    },
  };
}

/** Each slot's view-space direction, overwritten by the next draw. */
const viewDirections = Array.from({ length: MAX_DIRECTIONAL_LIGHTS }, () => new THREE.Vector3());

/** Scratch for the camera's rotation of one draw. */
const viewBasis = new THREE.Matrix3();

/** `inverse_transform.basis.xform` (`light_storage.cpp:640`), by the basis of the draw's camera. */
function viewDirection(light: DirectionalLight, slot: number): THREE.Vector3 {
  return viewDirections[slot]!.copy(light.direction).applyMatrix3(viewBasis).normalize();
}

/** The direction member, which takes the camera's basis once a draw before it fills the slots. */
function directionMember(): Binding<SpatialFrame> {
  const member = lightMember('direction', 'light_storage.cpp:640-644', viewDirection, NO_DIRECTION);
  return {
    ...member,
    value: (frame) => {
      viewBasis.setFromMatrix4(frame.camera.matrixWorldInverse);
      return member.value(frame);
    },
  };
}

/** Each member of the row that a light with no shadow fills (`light_storage.cpp:636-692`). */
export const DIRECTIONAL_LIGHT_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: 'scene_data_block.data.directional_light_count',
    godot: 'render_scene_data_rd.cpp:151',
    value: (frame) => Math.min(frame.directionalLights.length, MAX_DIRECTIONAL_LIGHTS),
  },
  directionMember(),
  // Without physical light units, the energy takes PI (`light_storage.cpp:650-654`).
  lightMember('energy', 'light_storage.cpp:648-654', (light) => light.energy * Math.PI, 0),
  lightMember('color', 'light_storage.cpp:660-663', (light) => light.color, NO_COLOR),
  lightMember('specular', 'light_storage.cpp:665', (light) => light.specular, 0),
  lightMember('volumetric_fog_energy', 'light_storage.cpp:666', (light) => light.volumetricFogEnergy, 0),
  lightMember('mask', 'light_storage.cpp:667', (light) => light.cullMask >>> 0, 0),
  lightMember('size', 'light_storage.cpp:669-671', (light) => light.size, 0),
  // No light casts a shadow on a transpiled surface yet: a shadow opacity of 0 skips every shadow read.
  lightMember('shadow_opacity', 'light_storage.cpp:673-675', () => 0, 0),
  lightMember('bake_mode', 'light_storage.cpp:692', (light) => light.bakeMode, 0),
];
