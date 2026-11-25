import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { compileCanvas, type CanvasCompile } from '../../shaders/canvas/compileCanvas';
import { writeCanvasBindings } from '../../shaders/canvas/canvasBindings';
import {
  INSTANCE_BYTES,
  writeBatchRecord,
  writeBatchWorld,
  WHITE,
  type CanvasItemDraw,
} from '../../shaders/canvas/canvasInstance';
import { quadBatchGeometry, rectInstanceData, textureRectRegion } from '../../shaders/canvas/canvasRect';
import { CanvasTextureBinding, type CanvasTextureState } from '../../shaders/canvas/canvasTexture';
import type { CanvasItemOptions, CanvasDraw, TranspiledCanvasItem } from '../../shaders/canvas/transpileCanvas';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { warnOnce } from '../../utils/warnOnce';
import { canvasFrameOf } from '../canvasFrame';
import { renderTargetSize } from '../renderTargetSize';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime';
import type { CanvasRectRegion } from './canvasCommands';
import { canvasTransformOf } from './canvasTransforms';
import { canvasTransformInto } from '../node2dTransform';
import { mutableTransform2D } from '../../godot/math/transform2d';

export { setMaterialParameters } from '../../shaders/uniforms/materialParameters';

/** A canvas_item shader transpiled for one item, or why the item draws Godot's default canvas shader. */
export type CanvasShader = Extract<CanvasCompile, { readonly item: unknown }> | { readonly refusal: string };

/** The material of `shader` for an item of a previewer 2D frame, whose GL row 0 is Godot's top row. */
export function canvasShaderOf(shader: ShaderText, options: CanvasItemOptions): CanvasShader {
  const compile = compileCanvas(shader.code, { ...options, file: shader.file, rows: 'godot' });
  if ('item' in compile) return compile;
  return { refusal: `[material] ${unDrawnMessage(compile, 'canvas_item', 'canvas shader')}` };
}

export function disposeCanvasShader(item: TranspiledCanvasItem): void {
  item.draw('quad').material.dispose();
  for (const parameter of item.parameters.values()) parameter.dispose?.();
}

/** What a rect's draw binds once: the item's texture with its sampler state. */
export interface RectTexture {
  readonly texture: THREE.Texture;
  readonly textureState: CanvasTextureState;
  readonly sampling: ProjectSampling;
}

/** What a rect's record and the frame's block read, which an animation may change each frame. */
export interface RectColors {
  readonly region: CanvasRectRegion;
  /** `Item::final_modulate`: the modulate chain times `self_modulate`, in sRGB. */
  readonly finalModulate: Rgba;
  /** The CanvasModulate colour of the item's canvas, white with none. */
  readonly canvasModulate: Rgba;
}

/** A translated item's draw: its three object, and the record writer the frame runs before the draw. */
export interface CanvasShaderDraw {
  readonly object: THREE.Object3D;
  /** Writes the rect's record and the colours the next frames read, with no new geometry. */
  readonly setRect: (colors: RectColors) => void;
  readonly writeRecords: () => void;
  readonly dispose: () => void;
}

/** The uniform each variant's vertex stage reads, whose object update writes the frame's block. */
const DRAW_HOOK = 'canvas_data.canvas_transform';

/** The quad batch of one rect, as Godot draws a Sprite2D (`renderer_canvas_render_rd.cpp:2406`). */
export function rectShaderDraw(gl: THREE.WebGLRenderer, item: TranspiledCanvasItem, bound: RectTexture): CanvasShaderDraw {
  const draw = item.draw('quad');
  const binding = new CanvasTextureBinding(draw, bound.sampling);
  const usesLinearColors = bound.textureState.usesLinearColors ?? false;
  const texelSize = binding.bind(bound.texture, bound.textureState);
  const geometry = quadBatchGeometry([new ArrayBuffer(INSTANCE_BYTES)]);
  const object = new THREE.Mesh(geometry, draw.material);
  object.frustumCulled = false;
  const world = mutableTransform2D();
  const frame = { canvasModulate: WHITE };
  writeFrameEachDraw(gl, draw, frame, usesLinearColors);
  return {
    object,
    setRect: ({ region: { rect, source, clipUv }, finalModulate, canvasModulate }) => {
      const itemDraw: CanvasItemDraw = { transform: canvasTransformInto(world, object), finalModulate, usesLinearColors };
      writeBatchRecord(geometry, 0, rectInstanceData(textureRectRegion(rect, source, WHITE, { clipUv }), itemDraw, texelSize));
      frame.canvasModulate = canvasModulate;
    },
    writeRecords: () => {
      object.updateWorldMatrix(true, false);
      writeBatchWorld(geometry, 0, canvasTransformInto(world, object));
    },
    dispose: () => {
      geometry.dispose();
      binding.dispose();
    },
  };
}

/** Scratch for the target size of one draw, overwritten by the next. */
const targetSize = new THREE.Vector2();

/** Writes the frame's `CanvasData` block before each draw, from the draw's camera and canvas. */
function writeFrameEachDraw(
  gl: THREE.WebGLRenderer,
  draw: CanvasDraw,
  frame: { readonly canvasModulate: Rgba },
  usesLinearColors: boolean
): void {
  const hook = draw.uniforms.get(DRAW_HOOK);
  if (!hook || !('onObjectUpdate' in hook))
    throw new Error(`expected a canvas draw to read the uniform ${DRAW_HOOK}, found ${hook ? 'an array' : 'none'}`);
  hook.onObjectUpdate(({ object, camera }) => {
    const { x: width, y: height } = renderTargetSize(gl, targetSize);
    writeCanvasBindings(draw, {
      width,
      height,
      canvasTransform: canvasTransformOf(camera!, canvasFrameOf(object!), { width, height }),
      canvasModulate: frame.canvasModulate,
      time: canvasShaderTime(gl).time,
      snapVerticesToPixel: false,
      usesLinearColors,
    });
  });
}

/** Warns once for `shader` when the GPU refuses a program of its draw. */
export function warnOnTranslatorFault(shader: ShaderText, item: TranspiledCanvasItem): void {
  item.draw('quad').material.onTranslatorFault = (fault) =>
    warnOnce(shader, 'translator fault', `[material] The previewer failed to draw this canvas_item shader: ${fault.message}`);
}
