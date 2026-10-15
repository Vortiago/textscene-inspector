/**
 * Godot 4.6.3's ReflectionProbe: its defaults, the capture's six faces, the reflection atlas its
 * captures live in, and the order the scene shader takes the probes in.
 */

import { sign } from '../../math/math.js';
import { storedReal, storedVector3 } from '../../math/real.js';
import {
  halvingSizes,
  paddedOctmap,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  type SkyOctmapLayout,
} from './skyReflection.js';
import { GODOT_EDITOR_LAYERS_MASK } from '../../scene/visualLayers.js';
import type { Vector3 } from '../../math/vector.js';

/** `ReflectionProbe::UpdateMode` (`scene/3d/reflection_probe.h:39-42`). */
export enum ReflectionProbeUpdateMode {
  /** Captures when the probe is added or changes, filtered by GGX importance sampling. */
  ONCE = 0,
  /** Captures every frame, filtered by the fast filter. */
  ALWAYS = 1,
}

/** `ReflectionProbe::AmbientMode` (`reflection_probe.h:44-48`). */
export enum ReflectionProbeAmbientMode {
  DISABLED = 0,
  /** The capture's last layer, along the surface normal. */
  ENVIRONMENT = 1,
  /** `ambient_color` times `ambient_color_energy`. */
  COLOR = 2,
}

/** `ReflectionProbe`'s defaults (`reflection_probe.h:52-67`). */
export const REFLECTION_PROBE_DEFAULTS = {
  intensity: 1,
  blendDistance: 1,
  maxDistance: 0,
  size: { x: 20, y: 20, z: 20 },
  originOffset: { x: 0, y: 0, z: 0 },
  ambientMode: ReflectionProbeAmbientMode.ENVIRONMENT,
  ambientColorEnergy: 1,
  layerMask: GODOT_EDITOR_LAYERS_MASK,
} as const;

/** `set_max_distance` clamps to this (`reflection_probe.cpp:81`). */
export const REFLECTION_PROBE_MAX_DISTANCE = 262_144;

/** The near plane of each capture face (`servers/rendering/renderer_scene_cull.cpp:3694`). */
export const CAPTURE_NEAR = 0.01;

/** The margin both setters keep between `origin_offset` and a face of the box. */
const FACE_MARGIN = 0.01;

/** The six capture faces' view directions, in Godot's face order (`renderer_scene_cull.cpp:3670-3677`). */
export const FACE_NORMALS: readonly Vector3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * The far plane of each capture face: the distance from the origin offset to that face of the box,
 * at least `maxDistance`. Godot keeps one distance across the loop, so a face never sees less far
 * than the faces before it (`renderer_scene_cull.cpp:3688-3694`).
 */
export function captureFarPlanes(size: Vector3, originOffset: Vector3, maxDistance: number): number[] {
  let far = maxDistance;
  return FACE_NORMALS.map((normal) => {
    const edge = { x: (normal.x * size.x) / 2, y: (normal.y * size.y) / 2, z: (normal.z * size.z) / 2 };
    far = Math.max(far, Math.abs(dot(normal, edge) - dot(normal, originOffset)));
    return far;
  });
}

/** The reflection atlas's capture size, `reflection_atlas/reflection_size` (`rendering_server.cpp:3733`). */
export const REFLECTION_ATLAS_SIZE = 256;

/**
 * `reflection_atlas/reflection_count` (`rendering_server.cpp:3735`): the atlas holds this many
 * captures, and a probe past them finds no layer (`light_storage.cpp:1581-1604`).
 */
export const REFLECTION_ATLAS_COUNT = 64;

/** An atlas that holds an update-always probe has this many layers (`light_storage.cpp:1514`). */
const REAL_TIME_ATLAS_LAYERS = 7;

/**
 * `MIN(roughness_layers, get_image_required_mipmaps(256, 256) + 1)` (`light_storage.cpp:1525`): the
 * sky's default layers, as a 256-wide image has nine mips.
 */
const ATLAS_LAYERS = SKY_ROUGHNESS_LAYERS_DEFAULT;

/**
 * The layout of the reflection atlas's octmaps (`light_storage.cpp:1524-1532`): the capture, twice
 * as wide to match a cube's texel density, in a border wide enough for the last layer. Each layer is
 * a mip, so it halves the one before (`sky.cpp:310-330`). One update-always probe recreates the
 * whole atlas with seven layers (`:1514-1519`), and the importance filter reads a half-size copy
 * with one mip fewer (`sky.cpp:338-343`).
 */
export function reflectionAtlasLayout(hasRealTimeProbe: boolean): SkyOctmapLayout {
  const layers = hasRealTimeProbe ? REAL_TIME_ATLAS_LAYERS : ATLAS_LAYERS;
  const { size, borderSize } = paddedOctmap(REFLECTION_ATLAS_SIZE, 2 ** (layers - 1));
  return {
    size,
    borderSize,
    layerSizes: halvingSizes(size, layers),
    downsampledSizes: halvingSizes(size >> 1, layers - 1),
  };
}

/**
 * `probes`, given in tree order, in the order Godot packs them: the largest box diagonal first
 * (`light_storage.cpp:1760-1771`). The scene shader takes the highest index first
 * (`scene_forward_clustered.glsl:2077-2086`), so the smallest box claims a fragment first.
 * Godot's cull lists the probes in reverse tree order, as it prepends each instance it queues
 * (`renderer_scene_cull.cpp:531`, `self_list.h:45-59`), and its insertion sort keeps that order for
 * equal boxes. So the first of two equal boxes in the tree wins. Past 16 probes Godot introsorts
 * (`sort_array.h:51`), which leaves equal boxes in no set order, so this keeps the tree order.
 */
export function reflectionProbeOrder<Probe extends { size: Vector3 }>(probes: readonly Probe[]): Probe[] {
  const diagonal = ({ size }: Probe) => Math.hypot(size.x, size.y, size.z);
  return [...probes].reverse().sort((a, b) => diagonal(b) - diagonal(a));
}

/**
 * The `origin_offset` Godot holds after it applies a file's `size` and `origin_offset` lines in
 * order. Each setter clamps each axis to `half_size - 0.01`, and only `set_size` floors `half_size`
 * at 0.01 (`reflection_probe.cpp:99-136`). An offset listed before `size` meets the default size.
 */
export function loadedOriginOffset(lines: Iterable<readonly ['size' | 'origin_offset', Vector3]>): Vector3 {
  let size: Vector3 = REFLECTION_PROBE_DEFAULTS.size;
  let offset: Vector3 = REFLECTION_PROBE_DEFAULTS.originOffset;
  for (const [key, value] of lines) {
    const stored = storedVector3(value);
    if (key === 'size') size = stored;
    else offset = stored;
    offset = clampedOffset(offset, size, key === 'size');
  }
  return offset;
}

function clampedOffset(offset: Vector3, size: Vector3, floorsHalfSize: boolean): Vector3 {
  const clampAxis = (axis: keyof Vector3): number => {
    let halfSize = storedReal(size[axis] / 2);
    if (floorsHalfSize && halfSize < FACE_MARGIN) halfSize = storedReal(FACE_MARGIN);
    const limit = halfSize - FACE_MARGIN;
    const component = offset[axis];
    return limit < Math.abs(component) ? storedReal(sign(component) * limit) : component;
  };
  return { x: clampAxis('x'), y: clampAxis('y'), z: clampAxis('z') };
}
