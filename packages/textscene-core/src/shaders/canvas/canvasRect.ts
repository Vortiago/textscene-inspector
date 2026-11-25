import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math.js';
import type { Rect2 } from '../../godot/math/rect2.js';
import type { Transform2DColumns } from '../../godot/math/transform2d.js';

/** `RendererCanvasRender::CANVAS_RECT_*` (`renderer_canvas_render.h:41-49`). */
export const CANVAS_RECT = {
  REGION: 1,
  TILE: 2,
  FLIP_H: 4,
  FLIP_V: 8,
  TRANSPOSE: 16,
  CLIP_UV: 32,
} as const;

/** `Item::CommandRect`: a rect of an item, in the item's pixels, with a texture region in texels. */
export interface CanvasRectCommand {
  readonly rect: Rect2;
  readonly source: Rect2;
  readonly modulate: Rgba;
  readonly flags: number;
}

/** `canvas_item_add_texture_rect_region` (`renderer_canvas_cull.cpp:1624`): a negative size flips. */
export function textureRectRegion(
  rect: Rect2,
  source: Rect2,
  modulate: Rgba,
  { transpose = false, clipUv = false } = {}
): CanvasRectCommand {
  let flags: number = CANVAS_RECT.REGION;
  const size = { w: rect.w, h: rect.h };
  const sourceSize = { w: source.w, h: source.h };
  if (size.w < 0) [flags, size.w] = [flags | CANVAS_RECT.FLIP_H, -size.w];
  if (sourceSize.w < 0) [flags, sourceSize.w] = [flags ^ CANVAS_RECT.FLIP_H, -sourceSize.w];
  if (size.h < 0) [flags, size.h] = [flags | CANVAS_RECT.FLIP_V, -size.h];
  if (sourceSize.h < 0) [flags, sourceSize.h] = [flags ^ CANVAS_RECT.FLIP_V, -sourceSize.h];
  if (transpose) [flags, size.w, size.h] = [flags | CANVAS_RECT.TRANSPOSE, size.h, size.w];
  if (clipUv) flags |= CANVAS_RECT.CLIP_UV;
  return {
    rect: { x: rect.x, y: rect.y, ...size },
    source: { x: source.x, y: source.y, ...sourceSize },
    modulate,
    flags,
  };
}

/** What a rect reads from the item that holds it. */
export interface CanvasItemDraw {
  /** The item's transform into the canvas, `Item::final_transform`. */
  readonly transform: Transform2DColumns;
  /** The item's modulate times its parents', times its self modulate: `Item::final_modulate`. */
  readonly finalModulate: Rgba;
}

/** `sizeof(InstanceData)` (`renderer_canvas_render_rd.h:379`). */
export const INSTANCE_BYTES = 128;

/** Float offsets of `InstanceData`'s rect members (`renderer_canvas_render_rd.h:355-377`). */
const WORLD = 0;
const MODULATION = 8;
const DST_RECT = 16;
const SRC_RECT = 20;
const FLAGS = 26;

/** `INSTANCE_FLAGS_*` of a rect (`canvas_uniforms_inc.glsl:9-10`). */
const INSTANCE_FLAGS_CLIP_RECT_UV = 1 << 4;
const INSTANCE_FLAGS_TRANSPOSE_RECT = 1 << 5;

/** `InstanceData` of `command` with no light (`renderer_canvas_render_rd.cpp:2406-2531`). */
export function rectInstanceData(
  command: CanvasRectCommand,
  item: CanvasItemDraw,
  /** The texture's `texpixel_size`, or nothing for a rect with no texture. */
  texelSize: { readonly x: number; readonly y: number } | undefined
): ArrayBuffer {
  const record = new ArrayBuffer(INSTANCE_BYTES);
  const floats = new Float32Array(record);
  const words = new Uint32Array(record);
  const { transform: t, finalModulate } = item;
  floats.set([t.a, t.b, t.c, t.d, t.tx, t.ty], WORLD);
  const { modulate } = command;
  floats.set(
    [
      modulate.r * finalModulate.r,
      modulate.g * finalModulate.g,
      modulate.b * finalModulate.b,
      modulate.a * finalModulate.a,
    ],
    MODULATION
  );
  floats.set(rectValues(command.rect), DST_RECT);
  floats.set(sourceRect(command, texelSize), SRC_RECT);
  words[FLAGS] = texelSize ? instanceFlags(command.flags) : 0;
  return record;
}

/** The rect with a negative size turned positive from its far edge. */
function rectValues({ x, y, w, h }: Rect2): number[] {
  return [w < 0 ? x + w : x, h < 0 ? y + h : y, Math.abs(w), Math.abs(h)];
}

/** The texture's region in 0 to 1, its size negated by a flip. */
function sourceRect(
  { flags, source }: CanvasRectCommand,
  texelSize: { x: number; y: number } | undefined
): number[] {
  if (!texelSize) return [0, 0, 1, 1];
  const region = flags & CANVAS_RECT.REGION;
  const [x, y, w, h] = region
    ? [source.x * texelSize.x, source.y * texelSize.y, source.w * texelSize.x, source.h * texelSize.y]
    : [0, 0, 1, 1];
  return [x, y, flags & CANVAS_RECT.FLIP_H ? -w : w, flags & CANVAS_RECT.FLIP_V ? -h : h];
}

function instanceFlags(flags: number): number {
  return (
    (flags & CANVAS_RECT.TRANSPOSE ? INSTANCE_FLAGS_TRANSPOSE_RECT : 0) |
    (flags & CANVAS_RECT.CLIP_UV ? INSTANCE_FLAGS_CLIP_RECT_UV : 0)
  );
}

/** `quad_index_buffer` (`renderer_canvas_render_rd.cpp:1945-1956`): two triangles over vertices 0 to 3. */
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

/** The vertex format of a rect batch (`renderer_canvas_render_rd.cpp:1960-2011`): eight vec4 per instance. */
const ATTRIBUTES = [
  'attrib_A',
  'attrib_B',
  'attrib_C',
  'attrib_D',
  'attrib_E',
  'attrib_F',
  'attrib_G',
  'attrib_H',
];

/** The first attribute read as unsigned integers, `R32G32B32A32_UINT`. */
const FIRST_UINT_ATTRIBUTE = 6;

/**
 * The geometry of a batch of rects: one instance for each record of `rectInstanceData`.
 * @canonical The instanced geometry of a canvas rect batch
 */
export function rectBatchGeometry(instances: readonly ArrayBuffer[]): THREE.InstancedBufferGeometry {
  const records = new ArrayBuffer(INSTANCE_BYTES * instances.length);
  instances.forEach((record, index) =>
    new Uint8Array(records, index * INSTANCE_BYTES).set(new Uint8Array(record))
  );
  const lanes = INSTANCE_BYTES / 4;
  const floats = new THREE.InstancedInterleavedBuffer(new Float32Array(records), lanes);
  const words = new THREE.InstancedInterleavedBuffer(new Uint32Array(records), lanes);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(QUAD_INDICES);
  ATTRIBUTES.forEach((name, index) => {
    const isUint = index >= FIRST_UINT_ATTRIBUTE;
    const attribute = new THREE.InterleavedBufferAttribute(isUint ? words : floats, 4, index * 4);
    geometry.setAttribute(name, attribute);
  });
  geometry.instanceCount = instances.length;
  return geometry;
}
