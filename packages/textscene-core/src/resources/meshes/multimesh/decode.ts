/**
 * A MultiMesh's property bag as the rendering server holds it after the scene loader sets each
 * property in file order (`scene/resources/multimesh.cpp`, the Forward+ storage in
 * `renderer_rd/storage_rd/mesh_storage.cpp`). Order matters: `instance_count` reallocates the
 * buffer, and the format setters refuse once it is positive. No THREE.
 */

import { parseOptionalAabb, parseOptionalInt } from '../../../parser/valueParsers.js';
import { boolSlotValue } from '../../../godot/variantBool.js';
import { holdsResource } from '../../../godot/geometryBase.js';
import { isEmptyAabb, EMPTY_AABB, type Aabb } from '../../../godot/aabb.js';
import {
  parsePackedColorArray,
  parsePackedFloat32Array,
  parsePackedVector2Array,
  parsePackedVector3Array,
} from '../../shapes/packedArray.js';
import type { MultiMeshData } from './types.js';

/** `MultiMesh::TRANSFORM_3D` (`multimesh.h:43`). Any other value takes the 2D read. */
const TRANSFORM_3D = 1;

/** Floats in one bounded transform: three basis rows, each with its origin component. */
const TRANSFORM_FLOATS = 12;

/**
 * The 2D read of `_multimesh_re_create_aabb` (`mesh_storage.cpp:1856-1865`): rows 0 and 1 from the
 * buffer, and the rest of an identity `Transform3D`.
 */
const TRANSFORM_2D_ROWS = [0, 1, -1, 3, 4, 5, -1, 7] as const;

/** The server's MultiMesh state that its box depends on. */
class MultiMeshState {
  format = 0;
  usesColors = false;
  usesCustomData = false;
  instances = 0;
  /** The server's visible count, -1 for all (`mesh_storage.cpp:2183-2215`). */
  visibleInstances = -1;
  customAabb: Aabb = EMPTY_AABB;
  hasMesh = false;
  /** The buffer once `multimesh_set_buffer` has set it. */
  buffer: Float32Array | null = null;
  /** The CPU copy the per-instance setters make (`_multimesh_make_local`, `:1716-1749`). */
  dataCache: Float32Array | null = null;
  isBoxDirty = false;
  boundedTransforms = new Float32Array(0);

  get stride(): number {
    const transform = this.format === TRANSFORM_3D ? 12 : 8;
    return transform + (this.usesColors ? 4 : 0) + (this.usesCustomData ? 4 : 0);
  }

  /** `multimesh_allocate_data` (`mesh_storage.cpp:1543-1598`). */
  allocate(instances: number): void {
    this.instances = instances;
    this.buffer = null;
    this.dataCache = null;
    this.isBoxDirty = false;
    this.boundedTransforms = new Float32Array(0);
    this.visibleInstances = Math.min(this.visibleInstances, instances);
  }

  makeLocal(): Float32Array {
    this.dataCache ??= this.buffer ? this.buffer.slice() : new Float32Array(this.instances * this.stride);
    return this.dataCache;
  }

  /** `_multimesh_re_create_aabb` (`mesh_storage.cpp:1831-1874`), over the first `count` instances. */
  bound(data: Float32Array, count: number): void {
    if (!this.hasMesh || !isEmptyAabb(this.customAabb)) return;
    const bounded = new Float32Array(count * TRANSFORM_FLOATS);
    for (let i = 0; i < count; i++) {
      const at = i * this.stride;
      const row = bounded.subarray(i * TRANSFORM_FLOATS, (i + 1) * TRANSFORM_FLOATS);
      if (this.format === TRANSFORM_3D) row.set(data.subarray(at, at + TRANSFORM_FLOATS));
      else boundTransform2D(row, data, at);
    }
    this.boundedTransforms = bounded;
  }

  /** `_update_dirty_multimeshes` (`mesh_storage.cpp:2253-2304`), which the box read runs first. */
  settle(): void {
    if (!this.dataCache || !this.isBoxDirty) return;
    this.isBoxDirty = false;
    this.bound(this.dataCache, this.visibleInstances >= 0 ? this.visibleInstances : this.instances);
  }
}

function boundTransform2D(row: Float32Array, data: Float32Array, at: number): void {
  row.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  TRANSFORM_2D_ROWS.forEach((source, i) => {
    if (source >= 0) row[i] = data[at + source]!;
  });
}

type Setter = (state: MultiMeshState, value: string) => void;

/** Each property's setter, as `multimesh.cpp` and the server's storage apply it. */
const SETTERS: Readonly<Record<string, Setter>> = {
  // `multimesh.cpp:337-358`: the format setters refuse once there are instances.
  transform_format(state, value) {
    if (state.instances === 0) state.format = parseOptionalInt(value) ?? state.format;
  },
  use_colors(state, value) {
    if (state.instances === 0) state.usesColors = boolSlotValue(value) === true;
  },
  use_custom_data(state, value) {
    if (state.instances === 0) state.usesCustomData = boolSlotValue(value) === true;
  },
  custom_aabb(state, value) {
    state.customAabb = parseOptionalAabb(value, 'MultiMesh.custom_aabb') ?? state.customAabb;
  },
  instance_count(state, value) {
    const count = parseOptionalInt(value);
    if (count !== undefined && count >= 0) state.allocate(count);
  },
  visible_instance_count: setVisibleInstances,
  mesh: setMesh,
  buffer: setBuffer,
  transform_array: setTransforms3D,
  transform_2d_array: setTransforms2D,
  color_array(state, value) {
    if (state.usesColors) setPerInstanceColours(state, value);
  },
  custom_data_array(state, value) {
    if (state.usesCustomData) setPerInstanceColours(state, value);
  },
};

/** `multimesh.cpp:241-246` and `multimesh_set_visible_instances` (`mesh_storage.cpp:2183-2211`). */
function setVisibleInstances(state: MultiMeshState, value: string): void {
  const count = parseOptionalInt(value);
  if (count === undefined || count < -1 || count > state.instances) return;
  if (count === state.visibleInstances) return;
  if (state.dataCache) state.isBoxDirty = true;
  state.visibleInstances = count;
}

/** `multimesh_set_mesh` (`mesh_storage.cpp:1662-1714`). */
function setMesh(state: MultiMeshState, value: string): void {
  const hasMesh = holdsResource(value);
  if (hasMesh === state.hasMesh) return;
  state.hasMesh = hasMesh;
  if (state.instances === 0) return;
  if (state.dataCache) state.isBoxDirty = true;
  else if (state.buffer) state.bound(state.buffer, state.instances);
}

/** `MultiMesh::set_buffer` (`multimesh.cpp:197-208`) and `multimesh_set_buffer` (`mesh_storage.cpp:2102-2153`). */
function setBuffer(state: MultiMeshState, value: string): void {
  if (state.instances === 0) return;
  const buffer = new Float32Array(parsePackedFloat32Array(value));
  if (buffer.length !== state.stride * state.instances) return;
  state.buffer = buffer;
  if (state.dataCache) {
    state.dataCache = buffer.slice();
    state.isBoxDirty = true;
  } else {
    state.bound(buffer, state.instances);
  }
}

/** The 3.x `transform_array` (`multimesh.cpp:38-60`), through `multimesh_instance_set_transform`. */
function setTransforms3D(state: MultiMeshState, value: string): void {
  if (state.format !== TRANSFORM_3D) return;
  const vectors = parsePackedVector3Array(value);
  const count = Math.floor(vectors.length / 3 / 4);
  if (count !== state.instances || count === 0) return;
  const cache = state.makeLocal();
  for (let i = 0; i < count; i++) {
    // Four vectors per instance: the basis rows, then the origin.
    const component = (vector: number, axis: number) => vectors[i * 12 + vector * 3 + axis]!;
    for (let row = 0; row < 3; row++) {
      const rowValues = [component(row, 0), component(row, 1), component(row, 2), component(3, row)];
      cache.set(rowValues, i * state.stride + row * 4);
    }
  }
  state.isBoxDirty = true;
}

/** The 3.x `transform_2d_array` (`multimesh.cpp:88-108`), through `mesh_storage.cpp:1913-1938`. */
function setTransforms2D(state: MultiMeshState, value: string): void {
  if (state.format !== 0) return;
  const vectors = parsePackedVector2Array(value);
  const count = Math.floor(vectors.length / 2 / 3);
  if (count !== state.instances || count === 0) return;
  const cache = state.makeLocal();
  for (let i = 0; i < count; i++) {
    // Three vectors per instance: the x and y columns, then the origin.
    const [xx, xy, yx, yy, ox, oy] = vectors.subarray(i * 6, i * 6 + 6);
    cache.set([xx!, yx!, 0, ox!, xy!, yy!, 0, oy!], i * state.stride);
  }
  state.isBoxDirty = true;
}

/**
 * The 3.x `color_array` and `custom_data_array` (`multimesh.cpp:136-180`). Their values never reach
 * the box, but each setter makes the CPU copy that later writes go through.
 */
function setPerInstanceColours(state: MultiMeshState, value: string): void {
  const colours = parsePackedColorArray(value);
  if (colours.length === 0 || colours.length / 4 !== state.instances) return;
  state.makeLocal();
}

/**
 * The state a MultiMesh's box reads, from its properties in file order. Throws on a packed array
 * this cannot read, which the caller takes as a box it does not know.
 */
export function decodeMultiMesh(properties: Readonly<Record<string, string>>): MultiMeshData {
  const state = new MultiMeshState();
  for (const [key, value] of Object.entries(properties)) {
    if (Object.hasOwn(SETTERS, key)) SETTERS[key]!(state, value);
  }
  state.settle();
  return {
    customAabb: isEmptyAabb(state.customAabb) ? null : state.customAabb,
    mesh: state.hasMesh ? properties['mesh'] : undefined,
    boundedTransforms: state.boundedTransforms,
  };
}
