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
  writeBatchRecords,
  writeBatchWorld,
  WHITE,
  type CanvasItemDraw,
} from '../../shaders/canvas/canvasInstance';
import {
  quadBatchGeometry,
  textureRectRegion,
  writeRectInstance,
  type CanvasRectCommand,
} from '../../shaders/canvas/canvasRect';
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
import { boundByItem, itemBox, type CanvasShaderCommand } from './canvasCommands';
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

type BoundFault = NonNullable<CanvasDraw['material']['onTranslatorFault']>;

/** Each item's drawn variants, written by `variantDraw`, and its warning, by `warnOnTranslatorFault`. */
const drawnOf = perObject((_item: TranspiledCanvasItem) => ({
  variants: new Set<CanvasVariant>(),
  warning: null as BoundFault | null,
}));

function variantDraw(item: TranspiledCanvasItem, variant: CanvasVariant): CanvasDraw {
  const draw = item.draw(variant);
  const drawn = drawnOf(item);
  drawn.variants.add(variant);
  if (drawn.warning) draw.material.onTranslatorFault = drawn.warning;
  return draw;
}

/** Frees what `item`'s draws hold. The variants stay listed: StrictMode reruns the effect with this item. */
export function disposeCanvasShader(item: TranspiledCanvasItem): void {
  for (const variant of drawnOf(item).variants) item.draw(variant).material.dispose();
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
  const drawn = drawnOf(item);
  drawn.warning = warning;
  for (const variant of drawn.variants) item.draw(variant).material.onTranslatorFault = warning;
}

/** What an item's draws bind for as long as they live: its CanvasTexture's maps and its sampler state. */
export interface ItemSampling {
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
  /** Binds `texture` (Godot's white default for null) and draws `commands` with the last colours. */
  readonly setSource: (texture: THREE.Texture | null, commands: readonly CanvasShaderCommand[]) => void;
  /** Orders the batches from `renderOrder` `firstOrder` on, inside the canvas item's group. */
  readonly setFirstOrder: (firstOrder: number) => void;
  /** Writes the records and the colours the next frames read, with no new geometry. */
  readonly setColors: (colors: ItemColors) => void;
  readonly writeRecords: () => void;
  readonly dispose: () => void;
}

/** One batch of an item's draw, which Godot starts for a run of rects or for each mesh (`:2406, :2764`). */
interface Batch {
  readonly object: THREE.Object3D;
  readonly setRun: (run: CommandRun) => void;
  readonly writeColors: (item: CanvasItemDraw) => void;
  readonly writeWorld: (world: MutableTransform2D) => void;
  readonly dispose: () => void;
}

/** One draw of a variant, with the texel size of the texture it binds, which its records read. */
interface BoundVariant {
  readonly draw: CanvasDraw;
  readonly binding: CanvasTextureBinding;
  texelSize: TexelSize | undefined;
}

/** An item's draw through Godot's canvas template, with the batches of `layout`. */
export function canvasShaderDraw(
  gl: THREE.WebGLRenderer,
  item: TranspiledCanvasItem,
  bound: ItemSampling,
  layout: readonly CanvasShaderCommand[]
): CanvasShaderDraw {
  // An Object3D, not a Group: three takes the group order from the nearest Group, the canvas item's key.
  const object = new THREE.Object3D();
  const usesLinearColors = bound.textureState.usesLinearColors ?? false;
  const canvas = { canvasModulate: WHITE, usesLinearColors };
  const variants = new Map<CanvasVariant, BoundVariant>();
  const variantOf = (variant: CanvasVariant): BoundVariant => {
    const held = variants.get(variant);
    if (held) return held;
    const draw = variantDraw(item, variant);
    const binding = new CanvasTextureBinding(draw, bound.sampling);
    const made = { draw, binding, texelSize: binding.bind(undefined, bound.textureState, bound.maps) };
    bindFrameEachDraw(gl, draw, canvas);
    variants.set(variant, made);
    return made;
  };
  const batches = commandRuns(layout).map((run) =>
    run.kind === 'rect' ? rectBatch(variantOf('quad'), run.commands) : meshBatch(variantOf, run.command)
  );
  for (const batch of batches) object.add(batch.object);
  const world = mutableTransform2D();
  // Written by `setColors`, and read again by `setSource`: new rects or texel sizes need new records.
  let finalModulate: Rgba | null = null;
  const writeColors = () => {
    if (!finalModulate) return;
    const itemDraw = { transform: canvasTransformInto(world, object), finalModulate, usesLinearColors };
    for (const batch of batches) batch.writeColors(itemDraw);
  };
  return {
    object,
    setSource: (texture, commands) => {
      for (const variant of variants.values())
        variant.texelSize = variant.binding.bind(texture ?? undefined, bound.textureState, bound.maps);
      commandRuns(commands).forEach((run, index) => batches[index]!.setRun(run));
      writeColors();
    },
    setFirstOrder: (firstOrder) =>
      // Godot draws an item's batches in command order: three compares this order inside the item's group.
      batches.forEach((batch, order) => (batch.object.renderOrder = firstOrder + order)),
    setColors: (colors) => {
      canvas.canvasModulate = colors.canvasModulate;
      finalModulate = colors.finalModulate;
      writeColors();
    },
    writeRecords: () => {
      object.updateWorldMatrix(true, false);
      canvasTransformInto(world, object);
      for (const batch of batches) batch.writeWorld(world);
    },
    dispose: () => {
      for (const batch of batches) batch.dispose();
      for (const { binding } of variants.values()) binding.dispose();
    },
  };
}

type RectCommand = Extract<CanvasShaderCommand, { kind: 'rect' }>;

type CommandRun =
  | { readonly kind: 'rect'; readonly commands: readonly RectCommand[] }
  | { readonly kind: 'mesh'; readonly command: Extract<CanvasShaderCommand, { kind: 'mesh' }> };

/** Consecutive rects as one batch (`renderer_canvas_render_rd.cpp:2406`). */
function commandRuns(commands: readonly CanvasShaderCommand[]): CommandRun[] {
  const runs: CommandRun[] = [];
  let rects: RectCommand[] | null = null;
  for (const command of commands) {
    if (command.kind === 'mesh') {
      runs.push({ kind: 'mesh', command });
      rects = null;
    } else if (rects) rects.push(command);
    else runs.push({ kind: 'rect', commands: (rects = [command]) });
  }
  return runs;
}

function rectBatch(variant: BoundVariant, layout: readonly RectCommand[]): Batch {
  const count = layout.length;
  const geometry = quadBatchGeometry(Array.from({ length: count }, () => new ArrayBuffer(INSTANCE_BYTES)));
  const object = new THREE.Mesh(geometry, variant.draw.material);
  object.frustumCulled = false;
  // Bounded by the layout until the first source, so a clip group reads the rects at once.
  const box = boundByItem(object, layout);
  let regions: readonly CanvasRectCommand[] = [];
  return {
    object,
    setRun: (run) => {
      if (run.kind !== 'rect') return;
      regions = run.commands.map(rectRegionOf);
      // The batch owns its quads, so each source writes the one box: AnimatedSprite2D sets one a frame.
      itemBox(box, run.commands);
    },
    writeColors: (item) =>
      writeBatchRecords(geometry, item, regions.length, (record, index) =>
        writeRectInstance(record, regions[index]!, item, variant.texelSize)
      ),
    writeWorld: (world) => {
      for (let index = 0; index < count; index++) writeBatchWorld(geometry, index, world);
    },
    dispose: () => geometry.dispose(),
  };
}

function rectRegionOf({
  region: { rect, source, clipUv, transpose },
  modulate,
}: RectCommand): CanvasRectCommand {
  return textureRectRegion(rect, source, modulate, { clipUv, transpose });
}

function meshBatch(
  variantOf: (variant: CanvasVariant) => BoundVariant,
  command: Extract<CanvasShaderCommand, { kind: 'mesh' }>
): Batch {
  const { arrays } = command;
  const { draw } = variantOf(attributesVariant(arrays.primitive));
  const geometry = attributesGeometry(arrays, draw);
  // Written in place by this batch, and read by the attributes draw before each draw.
  const constants = { world: mutableTransform2D(), modulation: WHITE };
  const object = attributesObject(draw, geometry, arrays.primitive, constants);
  boundByItem(object, [command]);
  return {
    object,
    // The layout holds the mesh's arrays, so a command of the same layout gives the same ones.
    setRun: () => {},
    // `canvas_item_add_mesh`'s white modulate times the item's (`renderer_canvas_render_rd.cpp:2764-2855`).
    writeColors: (item) => (constants.modulation = modulated(WHITE, item)),
    writeWorld: (world) => Object.assign(constants.world, world),
    dispose: () => {
      geometry.dispose();
      // An emulated points draw holds quads of its own beside the arrays.
      if (object.geometry !== geometry) object.geometry.dispose();
    },
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
