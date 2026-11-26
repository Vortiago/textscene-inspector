import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import {
  multiplyTransform2DInto,
  mutableTransform2D,
  TRANSFORM2D_IDENTITY,
  type MutableTransform2D,
} from '../../godot/math/transform2d';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { holdViewportAnisotropy } from '../viewportAnisotropy';
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
  writeItemLights,
  WHITE,
  type CanvasItemDraw,
} from '../../shaders/canvas/canvasInstance';
import {
  bindCanvasLightsEachDraw,
  NO_ITEM_LIGHTS,
  type ItemLightBits,
} from '../../shaders/canvas/canvasLights';
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
import {
  specialiseCanvasDraw,
  type CanvasDraw,
  type CanvasItemOptions,
  type CanvasVariant,
  type TranspiledCanvasItem,
} from '../../shaders/canvas/transpileCanvas';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import type { NodeFrame } from 'three/webgpu';
import { perObject } from '../../utils/perObject';
import { warnOnce } from '../../utils/warnOnce';
import { decalAtlasTexture } from '../../nodes/3d/decal/decalAtlas';
import type { CanvasLightRows } from '../lighting2d/lightRows';
import { canvasTransformInto } from '../node2dTransform';
import { boundByItem, itemBox, type CanvasShaderCommand } from './canvasCommands';
import { canvasDataOf, type CanvasColors, type CanvasItemFrame } from './canvasFrameBlocks';
import { canvasLightsOf } from './canvasFrameLights';

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

/** The lights that reach a lit item: its canvas's rows, its canvas layer and its indices into them. */
export interface ItemLighting {
  readonly rows: CanvasLightRows;
  readonly layer: number;
  readonly bits: ItemLightBits;
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
  /** Draws the lit variant of each program with `lighting`, or the unlit one for null. */
  readonly setLighting: (lighting: ItemLighting | null) => void;
  readonly writeRecords: () => void;
  /** Hands each mesh's object to its command's receiver, and returns the step that takes them back. */
  readonly handOver: () => () => void;
  readonly dispose: () => void;
}

/** One batch of an item's draw, which Godot starts for a run of rects or for each mesh (`:2406, :2764`). */
interface Batch {
  readonly object: THREE.Object3D;
  readonly setRun: (run: CommandRun) => void;
  readonly writeColors: (item: CanvasItemDraw, lights: ItemLightBits) => void;
  readonly writeWorld: (world: MutableTransform2D) => void;
  readonly handOver: () => () => void;
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
  // Written by `setSource`: three writes no taps for a nearest magnification, so the draw holds its copies.
  let releaseAnisotropy: readonly (() => void)[] = [];
  // The new holds come first, so a texture bound again never drops to no hold between two binds.
  const holdAnisotropy = () => {
    const released = releaseAnisotropy;
    releaseAnisotropy = [...variants.values()].flatMap(({ binding }) =>
      binding.boundTextures.map((texture) => holdViewportAnisotropy(gl, texture))
    );
    for (const release of released) release();
  };
  // Written by `setSource`, and bound again by `setLighting`: the lit stages read the light atlas too.
  let source: THREE.Texture | undefined;
  let isLit = false;
  const bindSource = () => {
    const lightAtlas = isLit ? decalAtlasTexture() : null;
    for (const variant of variants.values())
      variant.texelSize = variant.binding.bind(source, bound.textureState, bound.maps, lightAtlas);
    holdAnisotropy();
  };
  const world = mutableTransform2D();
  // Written by `setColors`, and read again by `setSource`: new rects or texel sizes need new records.
  let finalModulate: Rgba | null = null;
  // Written by `setLighting`, and read by each later record write.
  let lights = NO_ITEM_LIGHTS;
  const writeColors = () => {
    if (!finalModulate) return;
    const itemDraw = { transform: canvasTransformInto(world, object), finalModulate, usesLinearColors };
    for (const batch of batches) batch.writeColors(itemDraw, lights);
  };
  return {
    object,
    setSource: (texture, commands) => {
      source = texture ?? undefined;
      bindSource();
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
    setLighting: (lighting) => {
      for (const { draw } of variants.values()) lightDraw(gl, draw, lighting);
      const wasLit = isLit;
      isLit = lighting !== null;
      if (isLit !== wasLit) bindSource();
      lights = lighting?.bits ?? NO_ITEM_LIGHTS;
      writeColors();
    },
    writeRecords: () => {
      object.updateWorldMatrix(true, false);
      canvasTransformInto(world, object);
      for (const batch of batches) batch.writeWorld(world);
    },
    handOver: () => {
      const takeBacks = batches.map((batch) => batch.handOver());
      return () => takeBacks.forEach((takeBack) => takeBack());
    },
    dispose: () => {
      for (const release of releaseAnisotropy) release();
      for (const batch of batches) batch.dispose();
      for (const { binding } of variants.values()) binding.dispose();
    },
  };
}

type RectCommand = Extract<CanvasShaderCommand, { kind: 'rect' }>;

type MeshCommand = Exclude<CanvasShaderCommand, RectCommand>;

type CommandRun =
  | { readonly kind: 'rect'; readonly commands: readonly RectCommand[] }
  | { readonly kind: 'mesh'; readonly command: MeshCommand };

/** Consecutive rects as one batch, and each mesh as its own (`renderer_canvas_render_rd.cpp:2406, 2743`). */
function commandRuns(commands: readonly CanvasShaderCommand[]): CommandRun[] {
  const runs: CommandRun[] = [];
  let rects: RectCommand[] | null = null;
  for (const command of commands) {
    if (command.kind !== 'rect') {
      runs.push({ kind: 'mesh', command });
      rects = null;
    } else if (rects) rects.push(command);
    else runs.push({ kind: 'rect', commands: (rects = [command]) });
  }
  return runs;
}

const NOTHING_TO_TAKE_BACK = () => {};

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
    writeColors: (item, lights) =>
      writeBatchRecords(geometry, item, regions.length, (record, index) => {
        writeRectInstance(record, regions[index]!, item, variant.texelSize);
        writeItemLights(record, lights);
      }),
    writeWorld: (world) => {
      for (let index = 0; index < count; index++) writeBatchWorld(geometry, index, world);
    },
    handOver: () => NOTHING_TO_TAKE_BACK,
    dispose: () => geometry.dispose(),
  };
}

function rectRegionOf({
  region: { rect, source, clipUv, transpose },
  modulate,
}: RectCommand): CanvasRectCommand {
  return textureRectRegion(rect, source, modulate, { clipUv, transpose });
}

function meshBatch(variantOf: (variant: CanvasVariant) => BoundVariant, command: MeshCommand): Batch {
  const { arrays, transform = TRANSFORM2D_IDENTITY, meshRef } = command;
  const { draw } = variantOf(attributesVariant(arrays.primitive));
  const geometry = attributesGeometry(arrays, draw);
  // Written in place by this batch, and read by the attributes draw before each draw.
  const constants = {
    world: mutableTransform2D(),
    modulation: WHITE,
    lights: NO_ITEM_LIGHTS,
    instances: command.kind === 'multimesh' ? command.instances : undefined,
  };
  const object = attributesObject(draw, geometry, arrays.primitive, constants);
  boundByItem(object, [command]);
  return {
    object,
    // The layout holds the mesh's arrays and instance count, so only the instance buffer can change.
    setRun: (run) => {
      if (run.kind !== 'mesh' || run.command.kind !== 'multimesh') return;
      constants.instances = run.command.instances;
      itemBox(object.geometry.boundingBox!, [run.command]);
    },
    // `canvas_item_add_mesh`'s white modulate times the item's (`renderer_canvas_render_rd.cpp:2764-2855`).
    writeColors: (item, lights) => {
      constants.modulation = modulated(WHITE, item);
      constants.lights = lights;
    },
    writeWorld: (world) => multiplyTransform2DInto(constants.world, world, transform),
    handOver: () => {
      if (!meshRef) return NOTHING_TO_TAKE_BACK;
      meshRef(object);
      return () => meshRef(null);
    },
    dispose: () => {
      geometry.dispose();
      // An emulated points or a multimesh draw holds geometry of its own beside the arrays.
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
  hook.onObjectUpdate((frame: NodeFrame) =>
    bindCanvasData(draw, canvasDataOf(gl, itemFrameOf(frame), canvas))
  );
}

function itemFrameOf({ frameId, object, camera }: NodeFrame): CanvasItemFrame {
  return { frameId, object: object!, camera: camera! };
}

/** Each draw's lighting, which the light rows writer that `lightDraw` hooks once reads before each draw. */
const lightingOf = perObject((_draw: CanvasDraw) => ({
  current: null as ItemLighting | null,
  isHooked: false,
}));

/** Specialises `draw` for `lighting`, and writes its light rows before each draw while it is lit. */
function lightDraw(gl: THREE.WebGLRenderer, draw: CanvasDraw, lighting: ItemLighting | null): void {
  specialiseCanvasDraw(draw, { useLighting: lighting !== null });
  const held = lightingOf(draw);
  held.current = lighting;
  // After the lit stages: they declare `light_array`, and a draw's layouts each build a draw of it.
  if (!lighting || held.isHooked) return;
  held.isHooked = true;
  bindCanvasLightsEachDraw(draw, (frame) => {
    const lit = held.current;
    return lit && canvasLightsOf(gl, itemFrameOf(frame), lit.rows, lit.layer);
  });
}
