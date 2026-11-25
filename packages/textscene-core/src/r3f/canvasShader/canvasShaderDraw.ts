import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { mutableTransform2D, type MutableTransform2D } from '../../godot/math/transform2d';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import {
  attributesGeometry,
  attributesObject,
  attributesVariant,
} from '../../shaders/canvas/canvasAttributes';
import { bindCanvasData } from '../../shaders/canvas/canvasBindings';
import { compileCanvas, type CanvasCompile } from '../../shaders/canvas/compileCanvas';
import {
  INSTANCE_BYTES,
  modulated,
  writeBatchRecord,
  writeBatchWorld,
  WHITE,
  type CanvasItemDraw,
} from '../../shaders/canvas/canvasInstance';
import { quadBatchGeometry, rectInstanceData, textureRectRegion } from '../../shaders/canvas/canvasRect';
import {
  CanvasTextureBinding,
  type CanvasMaps,
  type CanvasTextureState,
  type TexelSize,
} from '../../shaders/canvas/canvasTexture';
import type {
  CanvasDraw,
  CanvasItemOptions,
  CanvasVariant,
  TranspiledCanvasItem,
} from '../../shaders/canvas/transpileCanvas';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import type { NodeFrame } from 'three/webgpu';
import { perObject } from '../../utils/perObject';
import { warnOnce } from '../../utils/warnOnce';
import { canvasTransformInto } from '../node2dTransform';
import type { CanvasShaderCommand } from './canvasCommands';
import { canvasDataOf, type CanvasColors } from './canvasFrameBlocks';

export { setMaterialParameters } from '../../shaders/uniforms/materialParameters';

/** A canvas_item shader transpiled for one item, or why the item draws Godot's default canvas shader. */
export type CanvasShader = Extract<CanvasCompile, { readonly item: unknown }> | { readonly refusal: string };

/** The material of `shader` for an item of a previewer 2D frame, whose GL row 0 is Godot's top row. */
export function canvasShaderOf(shader: ShaderText, options: CanvasItemOptions): CanvasShader {
  const compile = compileCanvas(shader.code, { ...options, file: shader.file, rows: 'godot' });
  if ('item' in compile) return compile;
  return { refusal: `[material] ${unDrawnMessage(compile, 'canvas_item', 'canvas shader')}` };
}

/** Written only by `variantDraw`: the variants each item's draws use, which `disposeCanvasShader` frees. */
const drawnVariantsOf = perObject((_item: TranspiledCanvasItem) => new Set<CanvasVariant>());

/** Written only by `warnOnTranslatorFault`: the warning each item's variants give. */
const faultWarningOf = perObject((_item: TranspiledCanvasItem): { warning: BoundFault | null } => ({
  warning: null,
}));

type BoundFault = NonNullable<CanvasDraw['material']['onTranslatorFault']>;

function variantDraw(item: TranspiledCanvasItem, variant: CanvasVariant): CanvasDraw {
  const draw = item.draw(variant);
  drawnVariantsOf(item).add(variant);
  const { warning } = faultWarningOf(item);
  if (warning) draw.material.onTranslatorFault = warning;
  return draw;
}

export function disposeCanvasShader(item: TranspiledCanvasItem): void {
  const variants = drawnVariantsOf(item);
  for (const variant of variants) item.draw(variant).material.dispose();
  variants.clear();
  for (const parameter of item.parameters.values()) parameter.dispose?.();
}

/** Warns once for `shader` when the GPU refuses a program of any variant its item draws. */
export function warnOnTranslatorFault(shader: ShaderText, item: TranspiledCanvasItem): void {
  const warning: BoundFault = (fault) =>
    warnOnce(
      shader,
      'translator fault',
      `[material] The previewer failed to draw this canvas_item shader: ${fault.message}`
    );
  faultWarningOf(item).warning = warning;
  for (const variant of drawnVariantsOf(item)) item.draw(variant).material.onTranslatorFault = warning;
}

/** What an item's draws bind once: its texture or none, its CanvasTexture's maps and its sampler state. */
export interface ItemTexture {
  readonly texture: THREE.Texture | null;
  readonly maps: CanvasMaps;
  readonly textureState: CanvasTextureState;
  readonly sampling: ProjectSampling;
}

/** What the records and the frame's block read, which an animation may change each frame. */
export interface ItemColors {
  /** `Item::final_modulate`: the modulate chain times `self_modulate`, in sRGB. */
  readonly finalModulate: Rgba;
  /** The CanvasModulate colour of the item's canvas, white with none. */
  readonly canvasModulate: Rgba;
}

/** A translated item's draw: its three object, and the record writer the frame runs before the draw. */
export interface CanvasShaderDraw {
  readonly object: THREE.Object3D;
  /** Writes the records and the colours the next frames read, with no new geometry. */
  readonly setColors: (colors: ItemColors) => void;
  readonly writeRecords: () => void;
  readonly dispose: () => void;
}

/** One batch of an item's draw, which Godot starts for a run of rects or for each mesh (`:2406, :2764`). */
interface Batch {
  readonly object: THREE.Object3D;
  readonly writeColors: (item: CanvasItemDraw) => void;
  readonly writeWorld: (world: MutableTransform2D) => void;
  readonly dispose: () => void;
}

/** One draw of a variant, with the texel size its records read. */
interface BoundVariant {
  readonly draw: CanvasDraw;
  readonly texelSize: TexelSize | undefined;
}

/** `commands` of one item drawn in order through Godot's canvas template, batches from `firstOrder` on. */
export function canvasShaderDraw(
  gl: THREE.WebGLRenderer,
  item: TranspiledCanvasItem,
  bound: ItemTexture,
  commands: readonly CanvasShaderCommand[],
  firstOrder: number
): CanvasShaderDraw {
  // An Object3D, not a Group: three takes the group order from the nearest Group, the canvas item's key.
  const object = new THREE.Object3D();
  const usesLinearColors = bound.textureState.usesLinearColors ?? false;
  const canvas = { canvasModulate: WHITE, usesLinearColors };
  const bindings: CanvasTextureBinding[] = [];
  const variants = new Map<CanvasVariant, BoundVariant>();
  const variantOf = (variant: CanvasVariant): BoundVariant => {
    const held = variants.get(variant);
    if (held) return held;
    const draw = variantDraw(item, variant);
    const binding = new CanvasTextureBinding(draw, bound.sampling);
    bindings.push(binding);
    const texelSize = binding.bind(bound.texture ?? undefined, bound.textureState, bound.maps);
    bindFrameEachDraw(gl, draw, canvas);
    const made = { draw, texelSize };
    variants.set(variant, made);
    return made;
  };
  const batches = commandRuns(commands).map((run) =>
    run.kind === 'rect' ? rectBatch(variantOf('quad'), run.commands) : meshBatch(variantOf, run.command)
  );
  batches.forEach((batch, order) => {
    // Godot draws an item's batches in command order: three compares this order inside the item's group.
    batch.object.renderOrder = firstOrder + order;
    object.add(batch.object);
  });
  const world = mutableTransform2D();
  return {
    object,
    setColors: ({ finalModulate, canvasModulate }) => {
      canvas.canvasModulate = canvasModulate;
      const itemDraw = { transform: canvasTransformInto(world, object), finalModulate, usesLinearColors };
      for (const batch of batches) batch.writeColors(itemDraw);
    },
    writeRecords: () => {
      object.updateWorldMatrix(true, false);
      canvasTransformInto(world, object);
      for (const batch of batches) batch.writeWorld(world);
    },
    dispose: () => {
      for (const batch of batches) batch.dispose();
      for (const binding of bindings) binding.dispose();
    },
  };
}

type CommandRun =
  | { readonly kind: 'rect'; readonly commands: readonly Extract<CanvasShaderCommand, { kind: 'rect' }>[] }
  | { readonly kind: 'mesh'; readonly command: Extract<CanvasShaderCommand, { kind: 'mesh' }> };

/** Consecutive rects as one batch (`renderer_canvas_render_rd.cpp:2406`). */
function commandRuns(commands: readonly CanvasShaderCommand[]): CommandRun[] {
  const runs: CommandRun[] = [];
  for (const command of commands) {
    const last = runs.at(-1);
    if (command.kind === 'mesh') runs.push({ kind: 'mesh', command });
    else if (last?.kind === 'rect') (last.commands as CanvasShaderCommand[]).push(command);
    else runs.push({ kind: 'rect', commands: [command] });
  }
  return runs;
}

function rectBatch(
  { draw, texelSize }: BoundVariant,
  rects: readonly Extract<CanvasShaderCommand, { kind: 'rect' }>[]
): Batch {
  const geometry = quadBatchGeometry(rects.map(() => new ArrayBuffer(INSTANCE_BYTES)));
  const object = new THREE.Mesh(geometry, draw.material);
  object.frustumCulled = false;
  return {
    object,
    writeColors: (item) =>
      rects.forEach(({ region: { rect, source, clipUv, transpose }, modulate }, index) =>
        writeBatchRecord(
          geometry,
          index,
          rectInstanceData(textureRectRegion(rect, source, modulate, { clipUv, transpose }), item, texelSize)
        )
      ),
    writeWorld: (world) => {
      for (let index = 0; index < rects.length; index++) writeBatchWorld(geometry, index, world);
    },
    dispose: () => geometry.dispose(),
  };
}

function meshBatch(
  variantOf: (variant: CanvasVariant) => BoundVariant,
  { arrays }: Extract<CanvasShaderCommand, { kind: 'mesh' }>
): Batch {
  const { draw } = variantOf(attributesVariant(arrays.primitive));
  const geometry = attributesGeometry(arrays);
  // Written in place by this batch, and read by the attributes draw before each draw.
  const constants = { world: mutableTransform2D(), modulation: WHITE };
  const object = attributesObject(draw, geometry, arrays.primitive, constants);
  return {
    object,
    // `canvas_item_add_mesh`'s white modulate times the item's (`renderer_canvas_render_rd.cpp:2764-2855`).
    writeColors: (item) => (constants.modulation = modulated(WHITE, item)),
    writeWorld: (world) => Object.assign(constants.world, world),
    dispose: () => geometry.dispose(),
  };
}

/** The uniform each variant's vertex stage reads, whose object update binds the canvas's block. */
const DRAW_HOOK = 'canvas_data.canvas_transform';

/** Binds the block of the canvas each draw of `draw` lands in, written once for all its items. */
function bindFrameEachDraw(gl: THREE.WebGLRenderer, draw: CanvasDraw, canvas: CanvasColors): void {
  const hook = draw.uniforms.get(DRAW_HOOK);
  if (!hook || !('onObjectUpdate' in hook))
    throw new Error(
      `expected a canvas draw to read the uniform ${DRAW_HOOK}, found ${hook ? 'an array' : 'none'}`
    );
  hook.onObjectUpdate(({ renderId, object, camera }: NodeFrame) =>
    bindCanvasData(draw, canvasDataOf(gl, { renderId, object: object!, camera: camera! }, canvas))
  );
}
