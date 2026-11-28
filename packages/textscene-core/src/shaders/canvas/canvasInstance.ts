import * as THREE from 'three';
import { srgbToLinearColor } from '../../godot/math/color.js';
import { multiplyColor, type Rgba } from '../../godot/math/math.js';
import type { Transform2DColumns } from '../../godot/math/transform2d.js';
import type { ItemLightBits } from './canvasLights.js';

/** What a command reads from the item that holds it and from the render target it draws to. */
export interface CanvasItemDraw {
  /** The item's transform into the canvas, `Item::final_transform`. */
  readonly transform: Transform2DColumns;
  /** The item's modulate times its parents', times its self modulate: `Item::final_modulate`. */
  readonly finalModulate: Rgba;
  /** Whether the render target keeps colours linear, `Viewport.use_hdr_2d`: `use_linear_colors`. */
  readonly usesLinearColors?: boolean;
}

export const WHITE: Rgba = Object.freeze({ r: 1, g: 1, b: 1, a: 1 });

/** `sizeof(InstanceData)` (`renderer_canvas_render_rd.h:379`). */
export const INSTANCE_BYTES = 128;

/** Float offset of `InstanceData::world`, the item transform's six floats. */
const WORLD = 0;

/** Float offset of `InstanceData::flags`, after the union. */
export const FLAGS = 26;

/** Float offset of `InstanceData::instance_uniforms_ofs`. */
const INSTANCE_UNIFORMS_OFS = 27;

/** Float offset of `InstanceData::lights`, four words. */
const LIGHTS = 28;

/** An item with no instance uniforms: `instance_allocated_shader_uniforms_offset` of -1, as a uint. */
export const NO_INSTANCE_UNIFORMS = 0xffffffff;

/** One record: its bytes, and the float and word views a command writes through. */
export interface InstanceRecord {
  readonly bytes: ArrayBuffer;
  readonly floats: Float32Array;
  readonly words: Uint32Array;
}

/** `template_instance` of an item with no light (`renderer_canvas_render_rd.cpp:2351-2355`). */
export function instanceRecord(item: CanvasItemDraw): InstanceRecord {
  const bytes = new ArrayBuffer(INSTANCE_BYTES);
  const floats = new Float32Array(bytes);
  const words = new Uint32Array(bytes);
  floats.set(worldOf(item.transform), WORLD);
  words[INSTANCE_UNIFORMS_OFS] = NO_INSTANCE_UNIFORMS;
  return { bytes, floats, words };
}

/** Adds the item's lights to the flags its command wrote (`renderer_canvas_render_rd.cpp:2385`). */
export function writeItemLights({ words }: InstanceRecord, { flags, lights }: ItemLightBits): void {
  words[FLAGS] = (words[FLAGS]! | flags) >>> 0;
  words.set(lights, LIGHTS);
}

/** `_update_transform_2d_to_mat2x3` (`renderer_canvas_render_rd.cpp:76`): the axes, then the origin. */
export function worldOf({ a, b, c, d, tx, ty }: Transform2DColumns): number[] {
  return [a, b, c, d, tx, ty];
}

/** Writes `transform` as record `index`'s world, and uploads the floats only when they change. */
export function writeBatchWorld(
  geometry: THREE.BufferGeometry,
  index: number,
  { a, b, c, d, tx, ty }: Transform2DColumns
): void {
  const floats = (geometry.getAttribute(ATTRIBUTES[0]!) as THREE.InterleavedBufferAttribute).data;
  const lanes = floats.array as Float32Array;
  const offset = index * floats.stride + WORLD;
  // Lane by lane, not through `worldOf`: this runs for each shaded item each frame.
  if (
    lanes[offset] === Math.fround(a) &&
    lanes[offset + 1] === Math.fround(b) &&
    lanes[offset + 2] === Math.fround(c) &&
    lanes[offset + 3] === Math.fround(d) &&
    lanes[offset + 4] === Math.fround(tx) &&
    lanes[offset + 5] === Math.fround(ty)
  )
    return;
  lanes[offset] = a;
  lanes[offset + 1] = b;
  lanes[offset + 2] = c;
  lanes[offset + 3] = d;
  lanes[offset + 4] = tx;
  lanes[offset + 5] = ty;
  floats.needsUpdate = true;
}

/** Writes a batch's first `count` records through one record of `item` that `write` fills, then uploads. */
export function writeBatchRecords(
  geometry: THREE.BufferGeometry,
  item: CanvasItemDraw,
  count: number,
  write: (record: InstanceRecord, index: number) => void
): void {
  const floats = (geometry.getAttribute(ATTRIBUTES[0]!) as THREE.InterleavedBufferAttribute).data;
  const words = (
    geometry.getAttribute(ATTRIBUTES[ATTRIBUTES.length - 1]!) as THREE.InterleavedBufferAttribute
  ).data;
  const floatLanes = floats.stride;
  const wordLanes = RECORD_LANES - floatLanes;
  const record = instanceRecord(item);
  const recordFloats = record.floats.subarray(0, floatLanes);
  const recordWords = record.words.subarray(floatLanes);
  for (let index = 0; index < count; index++) {
    write(record, index);
    (floats.array as Float32Array).set(recordFloats, index * floatLanes);
    (words.array as Uint32Array).set(recordWords, index * wordLanes);
  }
  floats.needsUpdate = true;
  words.needsUpdate = true;
}

/** Writes `record` as record `index`: its first `floatLanes` lanes into `floats`, the rest into `words`. */
function writeRecordInto(
  { floats, words }: { floats: Float32Array; words: Uint32Array },
  floatLanes: number,
  index: number,
  record: ArrayBuffer
): void {
  floats.set(new Float32Array(record, 0, floatLanes), index * floatLanes);
  words.set(new Uint32Array(record, floatLanes * 4), index * (RECORD_LANES - floatLanes));
}

/** `color * base_color`, turned linear for a linear render target (`renderer_canvas_render_rd.cpp:2425`). */
export function modulated(color: Rgba, item: CanvasItemDraw): Rgba {
  const product = multiplyColor(color, item.finalModulate);
  return item.usesLinearColors ? srgbToLinearColor(product) : product;
}

/** The vertex attributes of a record, eight vec4 in a row: `attrib_A` to `attrib_H`. */
const ATTRIBUTES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter) => `attrib_${letter}`);
const RECORD_LANES = INSTANCE_BYTES / 4;

/**
 * The first `floatAttributes` read floats and the rest `R32G32B32A32_UINT`, as the vertex format says.
 * @canonical The instanced geometry of a canvas batch of instance records
 */
export function instanceBatchGeometry(
  records: readonly ArrayBuffer[],
  floatAttributes: number,
  indices: readonly number[]
): THREE.InstancedBufferGeometry {
  const floatLanes = floatAttributes * 4;
  const wordLanes = RECORD_LANES - floatLanes;
  // Two buffers, as three uploads one GL buffer for each interleaved buffer: each byte goes up once.
  const floats = new Float32Array(floatLanes * records.length);
  const words = new Uint32Array(wordLanes * records.length);
  records.forEach((record, index) => writeRecordInto({ floats, words }, floatLanes, index, record));
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex([...indices]);
  setAttributes(geometry, ATTRIBUTES.slice(0, floatAttributes), floats, floatLanes);
  setAttributes(geometry, ATTRIBUTES.slice(floatAttributes), words, wordLanes);
  geometry.instanceCount = records.length;
  // The template places each vertex from its record, and the geometry has no `position` to bound.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return geometry;
}

/** One vec4 attribute of `names` for each four lanes of an instance's `lanes`. */
function setAttributes(
  geometry: THREE.BufferGeometry,
  names: readonly string[],
  array: Float32Array | Uint32Array,
  lanes: number
) {
  const buffer = new THREE.InstancedInterleavedBuffer(array, lanes);
  names.forEach((name, index) =>
    geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, 4, index * 4))
  );
}
