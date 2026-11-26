import { MAX_LIGHTS_PER_ITEM, MAX_LIGHTS_PER_RENDER } from '../../godot/rendering/rendering.js';
import type { Rgba } from '../../godot/math/math.js';
import {
  multiplyTransform2D,
  transform2DAffineInverse,
  transform2DXform,
  type Transform2DColumns,
} from '../../godot/math/transform2d.js';
import { normalizedVector2, type Vector2 } from '../../godot/math/vector.js';
import type { Rect2 } from '../../godot/math/rect2.js';
import type { NodeFrame } from 'three/webgpu';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import type { CanvasDraw } from './transpileCanvas.js';

/** One `Light` of `light_array` (`canvas_uniforms_inc.glsl:146-160`), as Godot fills it. */
export interface CanvasLightRow {
  /** Canvas pixels to the light texture's 0 to 1, or zero for a directional light. */
  readonly textureMatrix: Transform2DColumns;
  /** `color` with `alpha * energy` in alpha (`renderer_canvas_render_rd.cpp:626`). */
  readonly color: Rgba;
  /** `LIGHT_FLAGS_*`: the blend mode and the shadow filter. */
  readonly flags: number;
  readonly height: number;
  /** A positional light's place in canvas pixels, or the direction toward a directional light. */
  readonly position: Vector2;
  /** The light texture's rect in the light atlas, in 0 to 1. */
  readonly atlasRect: Rect2;
}

/** `Light2D`'s values that every row reads. */
export interface Light2DValues {
  readonly color: Rgba;
  readonly energy: number;
  /** `Light2D::BlendMode`. */
  readonly blendMode: number;
  /** `Light2D::ShadowFilter`. */
  readonly shadowFilter: number;
  readonly height: number;
}

/** A PointLight2D as `canvas_render_items` reads it (`renderer_canvas_render_rd.cpp:586-660`). */
export interface PointLightPlacement extends Light2DValues {
  /** The light's global transform on its own canvas, `xform_curr`. */
  readonly global: Transform2DColumns;
  /** `xform_cache`: the light's own canvas transform times `global`, in viewport pixels. */
  readonly onScreen: Transform2DColumns;
  /** The canvas transform of the canvas the row draws, `p_canvas_transform`. */
  readonly canvasTransform: Transform2DColumns;
  /** The light texture's size in texels. */
  readonly textureSize: { readonly width: number; readonly height: number };
  readonly textureScale: number;
  readonly textureOffset: Vector2;
  readonly atlasRect: Rect2;
}

/** A DirectionalLight2D as `canvas_render_items` reads it (`renderer_canvas_render_rd.cpp:525-578`). */
export interface DirectionalLightPlacement extends Light2DValues {
  /** `xform_cache`: the light's own canvas transform times its global transform. */
  readonly onScreen: Transform2DColumns;
}

/** `canvas_uniforms_inc.glsl:135-143`. */
const LIGHT_FLAGS_BLEND_SHIFT = 16;
const LIGHT_FLAGS_FILTER_SHIFT = 22;

const ZERO_TRANSFORM: Transform2DColumns = Object.freeze({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 });
const NO_ATLAS_RECT: Rect2 = Object.freeze({ x: 0, y: 0, w: 0, h: 0 });

/** Shadows stay on the classic pass, so a row never sets `LIGHT_FLAGS_HAS_SHADOW`. */
function lightFlags({ blendMode, shadowFilter }: Light2DValues): number {
  return (blendMode << LIGHT_FLAGS_BLEND_SHIFT) | (shadowFilter << LIGHT_FLAGS_FILTER_SHIFT);
}

function energyColor({ color, energy }: Light2DValues): Rgba {
  return { r: color.r, g: color.g, b: color.b, a: color.a * energy };
}

/** The mean length of the canvas transform's axes, which scales a positional light's height (`:620`). */
function axisScale({ a, b, c, d }: Transform2DColumns): number {
  return (Math.hypot(a, b) + Math.hypot(c, d)) * 0.5;
}

/** Maps `Rect2(-tsize / 2 + texture_offset, tsize)` onto 0 to 1 (`renderer_viewport.cpp:452-476`). */
function textureRectTransform({ textureSize, textureScale, textureOffset }: PointLightPlacement) {
  const width = textureSize.width * textureScale;
  const height = textureSize.height * textureScale;
  return {
    a: width,
    b: 0,
    c: 0,
    d: height,
    tx: -width / 2 + textureOffset.x,
    ty: -height / 2 + textureOffset.y,
  };
}

/** A PointLight2D's row (`renderer_canvas_render_rd.cpp:612-656`). */
export function pointLightRow(light: PointLightPlacement): CanvasLightRow {
  const { global, onScreen, canvasTransform } = light;
  const shaderTransform = multiplyTransform2D(onScreen, textureRectTransform(light));
  return {
    textureMatrix: transform2DAffineInverse(shaderTransform),
    color: energyColor(light),
    flags: lightFlags(light),
    height: light.height * axisScale(canvasTransform),
    position: transform2DXform(canvasTransform, { x: global.tx, y: global.ty }),
    atlasRect: light.atlasRect,
  };
}

/** A DirectionalLight2D's row: the direction toward it is minus its normalised y axis (`:542-549`). */
export function directionalLightRow(light: DirectionalLightPlacement): CanvasLightRow {
  const axis = normalizedVector2({ x: light.onScreen.c, y: light.onScreen.d });
  return {
    textureMatrix: ZERO_TRANSFORM,
    color: energyColor(light),
    flags: lightFlags(light),
    height: light.height,
    position: { x: -axis.x, y: -axis.y },
    atlasRect: NO_ATLAS_RECT,
  };
}

/** `sizeof(LightUniform)` in 32-bit words (`renderer_canvas_render_rd.h:443-457`). */
const LIGHT_ROW_WORDS = 32;

/** Word offsets of the members of `Light` at std430. */
const TEXTURE_MATRIX = 0;
const COLOR = 16;
const FLAGS = 21;
const SHADOW_PIXEL_SIZE = 22;
const HEIGHT = 23;
const POSITION = 24;
const SHADOW_ZFAR_INV = 26;
const ATLAS_RECT = 28;

/** `_update_transform_2d_to_mat2x4` (`renderer_canvas_render_rd.cpp:64`): each row with its origin. */
function writeMat2x4(floats: Float32Array, offset: number, { a, b, c, d, tx, ty }: Transform2DColumns): void {
  floats.set([a, c, 0, tx, b, d, 0, ty], offset);
}

/** `rows` as `light_array` holds them, at most `MAX_LIGHTS_PER_RENDER`. */
export function lightArrayWords(rows: readonly CanvasLightRow[]): Uint32Array {
  if (rows.length > MAX_LIGHTS_PER_RENDER)
    throw new Error(`expected at most ${MAX_LIGHTS_PER_RENDER} lights in a render, got ${rows.length}`);
  const floats = new Float32Array(rows.length * LIGHT_ROW_WORDS);
  const words = new Uint32Array(floats.buffer);
  rows.forEach((row, index) => {
    const base = index * LIGHT_ROW_WORDS;
    writeMat2x4(floats, base + TEXTURE_MATRIX, row.textureMatrix);
    const { r, g, b, a } = row.color;
    floats.set([r, g, b, a], base + COLOR);
    words[base + FLAGS] = row.flags;
    // With no shadow atlas Godot writes 1 for both (`:633-635`).
    floats[base + SHADOW_PIXEL_SIZE] = 1;
    floats[base + SHADOW_ZFAR_INV] = 1;
    floats[base + HEIGHT] = row.height;
    floats.set([row.position.x, row.position.y], base + POSITION);
    const { x, y, w, h } = row.atlasRect;
    floats.set([x, y, w, h], base + ATLAS_RECT);
  });
  return words;
}

/** The positional lights an item takes (`renderer_canvas_render_rd.cpp:2380`). */
export const MAX_POSITIONAL_LIGHTS = MAX_LIGHTS_PER_ITEM - 1;

/** An item's `lights` and the light count of its `flags` (`renderer_canvas_render_rd.cpp:2366-2386`). */
export interface ItemLightBits {
  /** The count in bits 0 to 3 (`INSTANCE_FLAGS_LIGHT_COUNT_SHIFT`). */
  readonly flags: number;
  /** Four words of four 8-bit light indices each. */
  readonly lights: readonly [number, number, number, number];
}

export const NO_ITEM_LIGHTS: ItemLightBits = Object.freeze({
  flags: 0,
  lights: Object.freeze([0, 0, 0, 0]) as unknown as readonly [number, number, number, number],
});

/** The bits of an item that takes the lights at `indices` of `light_array`, in order. */
export function itemLightBits(indices: readonly number[]): ItemLightBits {
  if (indices.length > MAX_POSITIONAL_LIGHTS)
    throw new Error(`expected at most ${MAX_POSITIONAL_LIGHTS} lights on an item, got ${indices.length}`);
  if (indices.length === 0) return NO_ITEM_LIGHTS;
  const lights: [number, number, number, number] = [0, 0, 0, 0];
  indices.forEach((index, count) => {
    lights[count >> 2] = (lights[count >> 2]! | (index << ((count & 3) * 8))) >>> 0;
  });
  return { flags: indices.length, lights };
}

/** What a lit draw reads of its canvas layer's lights in one render. */
export interface CanvasLightsFrame {
  /** `light_array`: the directional rows, then the positional ones. */
  readonly words: Uint32Array;
  readonly directionalCount: number;
}

const LIGHT_BINDINGS: readonly Binding<CanvasLightsFrame>[] = [
  {
    uniform: 'canvas_data.directional_light_count',
    godot: 'renderer_canvas_render_rd.cpp:707',
    value: ({ directionalCount }) => directionalCount,
  },
];

/** The light frame of a draw, or null for one that reads no light. */
export type LightsFrameOf = (frame: NodeFrame) => CanvasLightsFrame | null;

/** Writes `draw`'s `light_array` before each draw, uploading only when another array replaces it. */
export function bindCanvasLightsEachDraw(draw: CanvasDraw, framesOf: LightsFrameOf): void {
  let written: Uint32Array | null = null;
  draw.buffers.get('light_array')?.writeEachDraw((_object, nodeFrame) => {
    const lights = framesOf(nodeFrame);
    if (!lights) return null;
    writeBindings(LIGHT_BINDINGS, draw.uniforms, lights);
    if (lights.words === written) return null;
    return (written = lights.words);
  });
}
