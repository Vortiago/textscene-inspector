import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math.js';
import { compileCanvas } from '../../shaders/canvas/compileCanvas.js';
import { writeCanvasBindings } from '../../shaders/canvas/canvasBindings.js';
import { writeBatchWorld, WHITE, type CanvasItemDraw } from '../../shaders/canvas/canvasInstance.js';
import { quadBatchGeometry, rectInstanceData, textureRectRegion } from '../../shaders/canvas/canvasRect.js';
import { CanvasTextureBinding, type CanvasTextureState } from '../../shaders/canvas/canvasTexture.js';
import type { CanvasItemOptions, CanvasDraw, TranspiledCanvasItem } from '../../shaders/canvas/transpileCanvas.js';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal.js';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers.js';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState.js';
import type { ShaderText } from '../../resources/materials/shadermaterial/types.js';
import { warnOnce } from '../../utils/warnOnce.js';
import { canvasFrameOf } from '../canvasFrame.js';
import { renderTargetSize } from '../renderTargetSize.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';
import type { CanvasRectRegion } from './canvasCommands.js';
import { canvasTransformOf, itemTransformOf } from './canvasTransforms.js';

export { setMaterialParameters } from '../../shaders/uniforms/materialParameters.js';

/** A canvas_item shader transpiled for one item, or why the item draws Godot's default canvas shader. */
export type CanvasShader =
  | { readonly item: TranspiledCanvasItem; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: string };

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

/** What a rect of an item reads beside its command: the item's colours, its texture and the frame's. */
export interface RectInputs {
  readonly region: CanvasRectRegion;
  /** `Item::final_modulate`: the modulate chain times `self_modulate`, in sRGB. */
  readonly finalModulate: Rgba;
  readonly texture: THREE.Texture;
  readonly textureState: CanvasTextureState;
  readonly sampling: ProjectSampling;
  /** The CanvasModulate colour of the item's canvas, white with none. */
  readonly canvasModulate: Rgba;
}

/** A translated item's draw: its three object, and the record writer the frame runs before the draw. */
export interface CanvasShaderDraw {
  readonly object: THREE.Object3D;
  readonly writeRecords: () => void;
  readonly dispose: () => void;
}

/** The uniform each variant's vertex stage reads, whose object update writes the frame's block. */
const DRAW_HOOK = 'canvas_data.canvas_transform';

/** The quad batch of one rect, as Godot draws a Sprite2D (`renderer_canvas_render_rd.cpp:2406`). */
export function rectShaderDraw(gl: THREE.WebGLRenderer, item: TranspiledCanvasItem, inputs: RectInputs): CanvasShaderDraw {
  const draw = item.draw('quad');
  const binding = new CanvasTextureBinding(draw, inputs.sampling);
  const usesLinearColors = inputs.textureState.usesLinearColors ?? false;
  const texelSize = binding.bind(inputs.texture, inputs.textureState);
  const { rect, source, clipUv } = inputs.region;
  const itemDraw: CanvasItemDraw = {
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    finalModulate: inputs.finalModulate,
    usesLinearColors,
  };
  const record = rectInstanceData(textureRectRegion(rect, source, WHITE, { clipUv }), itemDraw, texelSize);
  const geometry = quadBatchGeometry([record]);
  const object = new THREE.Mesh(geometry, draw.material);
  object.frustumCulled = false;
  writeFrameEachDraw(gl, draw, inputs.canvasModulate, usesLinearColors);
  return {
    object,
    writeRecords: () => {
      object.updateWorldMatrix(true, false);
      writeBatchWorld(geometry, 0, itemTransformOf(object, canvasFrameOf(object)));
    },
    dispose: () => {
      geometry.dispose();
      binding.dispose();
    },
  };
}

/** Scratch for the target size of one draw, overwritten by the next. */
const targetSize = new THREE.Vector2();

/** Writes the frame's `CanvasData` block before each draw of `draw`, from the camera and canvas it draws in. */
function writeFrameEachDraw(
  gl: THREE.WebGLRenderer,
  draw: CanvasDraw,
  canvasModulate: Rgba,
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
      canvasModulate,
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
