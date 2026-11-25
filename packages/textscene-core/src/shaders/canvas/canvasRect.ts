import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math.js';
import type { Rect2 } from '../../godot/math/rect2.js';
import {
  type CanvasItemDraw,
  FLAGS,
  instanceBatchGeometry,
  instanceRecord,
  modulated,
} from './canvasInstance.js';
import type { TexelSize } from './canvasTexture.js';

/** `RendererCanvasRender::CANVAS_RECT_*` (`renderer_canvas_render.h:41-49`). */
export const CANVAS_RECT = {
  REGION: 1,
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

/** Float offsets of `InstanceData`'s rect members (`renderer_canvas_render_rd.h:359-363`). */
const MODULATION = 8;
const NINEPATCH_MARGINS = 12;
const DST_RECT = 16;
const SRC_RECT = 20;

/** `INSTANCE_FLAGS_*` of a rect (`canvas_uniforms_inc.glsl:9-10`). */
const INSTANCE_FLAGS_CLIP_RECT_UV = 1 << 4;
const INSTANCE_FLAGS_TRANSPOSE_RECT = 1 << 5;

/** `InstanceData` of `command` with no light (`renderer_canvas_render_rd.cpp:2406-2531`). */
export function rectInstanceData(
  command: CanvasRectCommand,
  item: CanvasItemDraw,
  /** The texture's `texpixel_size`, or nothing for a rect with no texture. */
  texelSize: TexelSize | undefined
): ArrayBuffer {
  const { bytes, floats, words } = instanceRecord(item);
  const { r, g, b, a } = modulated(command.modulate, item);
  floats.set([r, g, b, a], MODULATION);
  floats.set(rectValues(command.rect), DST_RECT);
  floats.set(sourceRect(command, texelSize), SRC_RECT);
  words[FLAGS] = texelSize ? instanceFlags(command.flags) : 0;
  return bytes;
}

/** The rect with a negative size turned positive from its far edge. */
function rectValues({ x, y, w, h }: Rect2): number[] {
  return [w < 0 ? x + w : x, h < 0 ? y + h : y, Math.abs(w), Math.abs(h)];
}

/** The texture's region in 0 to 1, its size negated by a flip. */
function sourceRect({ flags, source }: CanvasRectCommand, texelSize: TexelSize | undefined): number[] {
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

/** `attrib_A` to `attrib_F` read floats (`renderer_canvas_render_rd.cpp:1960-2011`). */
const QUAD_FLOAT_ATTRIBUTES = 6;

/**
 * The geometry of a batch of rects or nine-patches: one instance for each record.
 * @canonical The instanced geometry of a canvas quad batch
 */
export function quadBatchGeometry(records: readonly ArrayBuffer[]): THREE.InstancedBufferGeometry {
  return instanceBatchGeometry(records, QUAD_FLOAT_ATTRIBUTES, QUAD_INDICES);
}

/** The nine-patch of `CanvasItem.draw_style_box` and `NinePatchRect`: `Item::CommandNinePatch`. */
export interface CanvasNinePatchCommand {
  /** The patch in the item's pixels. */
  readonly rect: Rect2;
  /** The texture's region in texels: the whole texture when its size is zero. */
  readonly source: Rect2;
  readonly modulate: Rgba;
  /** In the source's texels: left, top, right, bottom (`renderer_canvas_cull.cpp:1677-1680`). */
  readonly margins: readonly [number, number, number, number];
  readonly axisX: NinePatchAxisMode;
  readonly axisY: NinePatchAxisMode;
  readonly drawsCenter: boolean;
}

/** `RS::NinePatchAxisMode`, in its order. */
export const NINE_PATCH_AXIS_MODES = ['stretch', 'tile', 'tile_fit'] as const;
export type NinePatchAxisMode = (typeof NINE_PATCH_AXIS_MODES)[number];

/** `INSTANCE_FLAGS_NINEPATCH_*` (`canvas_uniforms_inc.glsl:12-14`). */
const NINEPATCH_DRAW_CENTER = 1 << 8;
const NINEPATCH_H_MODE_SHIFT = 9;
const NINEPATCH_V_MODE_SHIFT = 11;

/** Float offset of `InstanceData::ninepatch_pixel_size`. */
const NINEPATCH_PIXEL_SIZE = 6;

/** The texel size of the default canvas texture, which has no diffuse map (`texture_storage.cpp:752`). */
const DEFAULT_TEXEL_SIZE: TexelSize = { x: 1, y: 1 };

/** `InstanceData` of a nine-patch with no light (`renderer_canvas_render_rd.cpp:2560-2608`). */
export function ninePatchInstanceData(
  command: CanvasNinePatchCommand,
  item: CanvasItemDraw,
  /** The texture's `texpixel_size`, or nothing for a nine-patch with no texture. */
  texelSize: TexelSize | undefined
): ArrayBuffer {
  const { bytes, floats, words } = instanceRecord(item);
  const { source } = command;
  const hasSource = source.x !== 0 || source.y !== 0 || source.w !== 0 || source.h !== 0;
  if (texelSize && hasSource) {
    floats.set(
      [source.x * texelSize.x, source.y * texelSize.y, source.w * texelSize.x, source.h * texelSize.y],
      SRC_RECT
    );
    floats.set([1 / source.w, 1 / source.h], NINEPATCH_PIXEL_SIZE);
  } else {
    const { x, y } = texelSize ?? DEFAULT_TEXEL_SIZE;
    floats.set([0, 0, 1, 1], SRC_RECT);
    floats.set([x, y], NINEPATCH_PIXEL_SIZE);
  }
  const { r, g, b, a } = modulated(command.modulate, item);
  floats.set([r, g, b, a], MODULATION);
  floats.set(command.margins, NINEPATCH_MARGINS);
  floats.set(rectValuesAsGiven(command.rect), DST_RECT);
  words[FLAGS] =
    (axisModeIndex(command.axisX) << NINEPATCH_H_MODE_SHIFT) |
    (axisModeIndex(command.axisY) << NINEPATCH_V_MODE_SHIFT) |
    (command.drawsCenter ? NINEPATCH_DRAW_CENTER : 0);
  return bytes;
}

function axisModeIndex(mode: NinePatchAxisMode): number {
  const index = NINE_PATCH_AXIS_MODES.indexOf(mode);
  if (index < 0) throw new Error(`expected an axis mode of ${NINE_PATCH_AXIS_MODES.join(', ')}, got ${mode}`);
  return index;
}

/** Godot turns no negative size of a nine-patch (`renderer_canvas_render_rd.cpp:2564`). */
const rectValuesAsGiven = ({ x, y, w, h }: Rect2) => [x, y, w, h];
