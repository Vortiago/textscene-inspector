import * as THREE from 'three';
import type { TextureNode } from 'three/webgpu';
import type { Binding } from '../uniforms/bindingTable.js';
import { comparedTextureOf, UNBOUND_DEPTH } from '../language/comparedTextures.js';
import type { SpatialFrame } from './spatialBindings.js';
import {
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  MAX_DIRECTIONAL_LIGHTS,
} from '../../godot/rendering/lights/directionalShadow.js';
import {
  SOFT_LOW_PENUMBRA_SAMPLES,
  SOFT_LOW_SHADOW_SAMPLES,
  vogelDisk,
} from '../../godot/rendering/lights/softShadowKernel.js';
import { SCENE_DATA } from './sceneDataBlock.js';
import {
  bindDirectionalShadowColour,
  directionalShadowAtlasNode,
  type StoredDepthRead,
} from './directionalShadowDepth.js';

/** A sun's shadow in the directional shadow atlas, as its row reads it (`light_storage.cpp:694-756`). */
export interface DirectionalShadow {
  /** `shadow_opacity`. */
  readonly opacity: number;
  /** `soft_shadow_scale`: the PCF kernel's radius in atlas texels. */
  readonly softShadowScale: number;
  /** `softshadow_angle`: the tangent of `light_angular_distance`. */
  readonly softShadowAngle: number;
  /** `blend_splits`: off in Orthogonal mode whatever the light sets. */
  readonly blendSplits: boolean;
  /** The view depths the fade runs between, positive: Godot's `fade_from` and `fade_to` negated. */
  readonly fade: { readonly from: number; readonly to: number };
  /** Four lanes each, one per split: `shadow_split_offsets`, `shadow_bias` and `shadow_normal_bias`. */
  readonly splitEnds: ArrayLike<number>;
  /** In world units along the light's direction, as the receiver moves by it. */
  readonly depthBiases: ArrayLike<number>;
  /** In world units. */
  readonly normalBiases: ArrayLike<number>;
  /** In world units, along the receiver's normal. */
  readonly transmittanceBiases: ArrayLike<number>;
  /** Each split box's light side along the light's +Z, in world units: Godot's `range_begin`. */
  readonly rangeBegins: ArrayLike<number>;
  /** Each split box's depth in world units, from its light side to its far side: Godot's `farplane`. */
  readonly zRanges: ArrayLike<number>;
  /** World space to split `split`'s atlas UV in x and y, and the stored depth its compare reads in z. */
  splitMatrix(split: number): THREE.Matrix4;
}

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
  /** Nothing for a light that casts no shadow in this render. */
  readonly shadow?: DirectionalShadow;
}

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

/** A shadow member, which a light without a shadow fills with `empty`. */
function shadowMember<T>(
  member: string,
  godot: string,
  valueOf: (shadow: DirectionalShadow, slot: number, frame: SpatialFrame) => T,
  empty: T
): Binding<SpatialFrame> {
  return lightMember(
    member,
    godot,
    (light, slot, frame) => (light.shadow ? valueOf(light.shadow, slot, frame) : empty),
    empty
  );
}

const NO_LANES: Readonly<THREE.Vector4> = new THREE.Vector4();

/** A member of four lanes, one per split, in a vector per slot that the next draw overwrites. */
function splitLanesMember(
  member: string,
  godot: string,
  lanesOf: (shadow: DirectionalShadow) => ArrayLike<number>
) {
  const vectors = Array.from({ length: MAX_DIRECTIONAL_LIGHTS }, () => new THREE.Vector4());
  return shadowMember(
    member,
    godot,
    (shadow, slot) => vectors[slot]!.fromArray(lanesOf(shadow) as number[]),
    NO_LANES
  );
}

const NO_MATRIX: Readonly<THREE.Matrix4> = new THREE.Matrix4().makeScale(0, 0, 0);

/** The map from the stored depth `t` to Godot's `1 - t`: a split box's near side is Godot's. */
const GODOT_DEPTH: Readonly<THREE.Matrix4> = new THREE.Matrix4().set(
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  -1,
  1,
  0,
  0,
  0,
  1
);

/** `shadow_matrix1` to `4` take a view-space vertex to Godot's depth, which the atlas reads map back. */
function splitMatrixMember(split: number): Binding<SpatialFrame> {
  const matrices = Array.from({ length: MAX_DIRECTIONAL_LIGHTS }, () => new THREE.Matrix4());
  return shadowMember(
    `shadow_matrix${split + 1}`,
    'light_storage.cpp:706-728',
    (shadow, slot, frame) => {
      return matrices[slot]!.multiplyMatrices(GODOT_DEPTH, shadow.splitMatrix(split)).multiply(
        frame.camera.matrixWorld
      );
    },
    NO_MATRIX
  );
}

const NO_UV_SCALE: Readonly<THREE.Vector2> = new THREE.Vector2();

/** Scratch for one row of a split matrix. */
const matrixRow = new THREE.Vector3();

/** `uv_scale1` to `4`: the atlas UV per world unit across the split box, its matrix's first two rows. */
function uvScaleMember(split: number): Binding<SpatialFrame> {
  const scales = Array.from({ length: MAX_DIRECTIONAL_LIGHTS }, () => new THREE.Vector2());
  const rowLength = ({ elements }: THREE.Matrix4, row: number) =>
    matrixRow.set(elements[row]!, elements[row + 4]!, elements[row + 8]!).length();
  return shadowMember(
    `uv_scale${split + 1}`,
    'light_storage.cpp:731-748',
    (shadow, slot) => {
      const matrix = shadow.splitMatrix(split);
      return scales[slot]!.set(rowLength(matrix, 0), rowLength(matrix, 1));
    },
    NO_UV_SCALE
  );
}

/** Each member of the row a light fills (`light_storage.cpp:636-756`). */
export const DIRECTIONAL_LIGHT_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: `${SCENE_DATA}.directional_light_count`,
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
  lightMember('bake_mode', 'light_storage.cpp:692', (light) => light.bakeMode, 0),
  // A shadow opacity of 0 skips every shadow read of the light, so its other shadow members stay unread.
  shadowMember('shadow_opacity', 'light_storage.cpp:673-675', (shadow) => shadow.opacity, 0),
  shadowMember('soft_shadow_scale', 'light_storage.cpp:697-701', (shadow) => shadow.softShadowScale, 0),
  shadowMember('softshadow_angle', 'light_storage.cpp:698', (shadow) => shadow.softShadowAngle, 0),
  shadowMember('blend_splits', 'light_storage.cpp:705', (shadow) => shadow.blendSplits, false),
  shadowMember('fade_from', 'light_storage.cpp:753', (shadow) => -shadow.fade.from, 0),
  shadowMember('fade_to', 'light_storage.cpp:754', (shadow) => -shadow.fade.to, 0),
  splitLanesMember('shadow_split_offsets', 'light_storage.cpp:721', (shadow) => shadow.splitEnds),
  splitLanesMember('shadow_bias', 'light_storage.cpp:722-723', (shadow) => shadow.depthBiases),
  splitLanesMember('shadow_normal_bias', 'light_storage.cpp:724', (shadow) => shadow.normalBiases),
  splitLanesMember(
    'shadow_transmittance_bias',
    'light_storage.cpp:725',
    (shadow) => shadow.transmittanceBiases
  ),
  splitLanesMember('shadow_z_range', 'light_storage.cpp:726', (shadow) => shadow.zRanges),
  splitLanesMember('shadow_range_begin', 'light_storage.cpp:727', (shadow) => shadow.rangeBegins),
  ...[0, 1, 2, 3].map(splitMatrixMember),
  ...[0, 1, 2, 3].map(uvScaleMember),
];

const DIRECTIONAL_SHADOW_PIXEL_SIZE = new THREE.Vector2(1, 1).divideScalar(DIRECTIONAL_SHADOW_SIZE_DEFAULT);

/** The first `count` lanes of a kernel: the Vogel disk taps that `store_soft_shadow_kernel` writes. */
const kernelOf = (count: number) => vogelDisk(count).map(([x, y]) => new THREE.Vector4(x, y, 0, 0));

/** `vec4 directional_soft_shadow_kernel[32]` (`render_scene_data_rd.cpp:124`). */
const DIRECTIONAL_SOFT_SHADOW_KERNEL = kernelOf(SOFT_LOW_SHADOW_SAMPLES);

/** `vec4 directional_penumbra_shadow_kernel[32]` (`render_scene_data_rd.cpp:123`). */
const DIRECTIONAL_PENUMBRA_SHADOW_KERNEL = kernelOf(SOFT_LOW_PENUMBRA_SAMPLES);

/** The members of the scene data the directional shadows read. */
export const DIRECTIONAL_SHADOW_SCENE_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: `${SCENE_DATA}.directional_shadow_pixel_size`,
    godot: 'renderer_scene_render_rd.cpp:1386-1390',
    value: () => DIRECTIONAL_SHADOW_PIXEL_SIZE,
  },
  {
    uniform: `${SCENE_DATA}.directional_soft_shadow_kernel`,
    godot: 'render_scene_data_rd.cpp:124',
    value: () => DIRECTIONAL_SOFT_SHADOW_KERNEL,
  },
  {
    uniform: `${SCENE_DATA}.directional_penumbra_shadow_kernel`,
    godot: 'render_scene_data_rd.cpp:123',
    value: () => DIRECTIONAL_PENUMBRA_SHADOW_KERNEL,
  },
];

/** A shadow has an angle only while the render draws soft shadows (`light_storage.cpp:680-686`). */
export function hasDirectionalSoftShadowAngle(lights: readonly DirectionalLight[]): boolean {
  return lights.some(({ shadow }) => (shadow?.softShadowAngle ?? 0) > 0);
}

/** The template's texture of the directional shadows. */
const DIRECTIONAL_SHADOW_ATLAS = 'directional_shadow_atlas';

/** Makes the template's reads of its directional atlas take Godot's depth. Call it before the emit. */
export function readDirectionalShadowAtlas(textures: Map<string, TextureNode>, read: StoredDepthRead): void {
  textures.set(DIRECTIONAL_SHADOW_ATLAS, directionalShadowAtlasNode(read));
}

/** Where a draw's directional atlas reads go: the depth it compares and the colour it reads raw. */
export interface DirectionalShadowAtlasTextures {
  readonly depth: THREE.DepthTexture;
  readonly colour: THREE.Texture;
}

/** Binds the atlas to the template's reads. With none, a compare reads one texel. */
export function bindDirectionalShadowAtlas(
  textures: ReadonlyMap<string, TextureNode>,
  atlas: DirectionalShadowAtlasTextures | undefined
): void {
  const node = textures.get(DIRECTIONAL_SHADOW_ATLAS);
  if (!node) return;
  comparedTextureOf(node).value = atlas?.depth ?? UNBOUND_DEPTH;
  bindDirectionalShadowColour(node, atlas?.colour);
}
