/**
 * Godot 4.6.3's ReflectionProbe in the renderer: its modes, the capture's six faces, the reflection
 * atlas its captures live in, and the order the scene shader takes the probes in.
 */

import {
  halvingSizes,
  paddedOctmap,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  type SkyOctmapLayout,
} from './skyReflection.js';
import { type Vector3, vector3Length } from '../../math/vector.js';
import { sortArray } from '../../templates/sortArray.js';

/** `ReflectionProbe::UpdateMode` (`scene/3d/reflection_probe.h:39-42`). */
export const ReflectionProbeUpdateMode = {
  /** Captures when the probe is added or changes, filtered by GGX importance sampling. */
  ONCE: 0,
  /** Captures every frame, filtered by the fast filter. */
  ALWAYS: 1,
} as const;

/** `ReflectionProbe::AmbientMode` (`reflection_probe.h:44-48`). */
export const ReflectionProbeAmbientMode = {
  DISABLED: 0,
  /** The capture's last layer, along the surface normal. */
  ENVIRONMENT: 1,
  /** `ambient_color` times `ambient_color_energy`. */
  COLOR: 2,
} as const;

/** The near plane of each capture face (`servers/rendering/renderer_scene_cull.cpp:3694`). */
export const CAPTURE_NEAR = 0.01;

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
 * (`renderer_scene_cull.cpp:531`, `self_list.h:45-59`). Its `SortArray` decides the order of
 * equal boxes: up to 16 probes the first of two in the tree wins.
 */
export function reflectionProbeOrder<Probe extends { size: Vector3 }>(probes: readonly Probe[]): Probe[] {
  const ordered = [...probes].reverse();
  sortArray(ordered, (a, b) => negativeHalfDiagonal(a) < negativeHalfDiagonal(b));
  return ordered;
}

/**
 * Godot's sort key, `-(size / 2).length()` (`light_storage.cpp:1760-1764`), in float step by step:
 * a double `hypot` rounds once, so it ties boxes Godot orders and splits boxes Godot ties.
 */
function negativeHalfDiagonal({ size }: { size: Vector3 }): number {
  const half = (edge: number) => Math.fround(Math.fround(edge) / 2);
  return -vector3Length(half(size.x), half(size.y), half(size.z));
}
