import * as THREE from 'three';
import { srgbToLinearColor } from '../../godot/math/color.js';
import type { Rgba } from '../../godot/math/math.js';
import type { Transform2DColumns } from '../../godot/math/transform2d.js';
import { normalizedVector2 } from '../../godot/math/vector.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import type { CanvasDraw } from './transpileCanvas.js';

/** Where Godot's viewport lies in a target: its top-left in target pixels, and its size in its own pixels. */
export interface TargetViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Target pixels per viewport pixel. */
  readonly scale: number;
}

/** What a canvas draw reads from its viewport, with no light. */
export interface CanvasFrame {
  /** The size of the render target in pixels. */
  readonly width: number;
  readonly height: number;
  /** Godot's viewport inside the target, or the whole target when left out. */
  readonly viewport?: TargetViewport;
  /** The canvas layer's transform, a Camera2D's view of it included. */
  readonly canvasTransform: Transform2DColumns;
  /** The CanvasModulate colour, or white with none. */
  readonly canvasModulate: Rgba;
  /** The shader time in seconds, `TIME`. */
  readonly time: number;
  /** `Viewport.snap_2d_vertices_to_pixel`. */
  readonly snapVerticesToPixel: boolean;
  /** Whether the render target keeps colours linear, `Viewport.use_hdr_2d`. */
  readonly usesLinearColors?: boolean;
}

/** `CANVAS_FLAGS_CONVERT_ATTRIBUTES_TO_LINEAR` (`canvas_uniforms_inc.glsl:114`). */
const CONVERT_ATTRIBUTES_TO_LINEAR = 1 << 0;

const DATA = 'canvas_data';

/** The `CanvasData` values of one frame, changed in place: one write reaches every draw bound to it. */
export interface CanvasDataBlock {
  readonly canvasTransform: THREE.Matrix4;
  readonly screenTransform: THREE.Matrix4;
  readonly canvasNormalTransform: THREE.Matrix4;
  readonly canvasModulation: THREE.Vector4;
  readonly screenPixelSize: THREE.Vector2;
  /** Godot's viewport in the target: its top-left, and viewport pixels per target pixel. */
  readonly viewportInTarget: THREE.Vector4;
  time: number;
  usesPixelSnap: boolean;
  flags: number;
}

export function canvasDataBlock(): CanvasDataBlock {
  return {
    canvasTransform: new THREE.Matrix4(),
    screenTransform: new THREE.Matrix4(),
    canvasNormalTransform: new THREE.Matrix4(),
    canvasModulation: new THREE.Vector4(),
    screenPixelSize: new THREE.Vector2(),
    viewportInTarget: new THREE.Vector4(0, 0, 1, 1),
    time: 0,
    usesPixelSnap: false,
    flags: 0,
  };
}

/** Writes `frame` into `block` (`renderer_canvas_render_rd.cpp:673-729`), with no new object. */
export function writeCanvasData(block: CanvasDataBlock, frame: CanvasFrame): void {
  const { width, height, canvasTransform, canvasModulate, usesLinearColors } = frame;
  transform2DMatrixInto(block.canvasTransform, canvasTransform);
  // Pixels to Vulkan's clip space, y down: `x * 2 / width - 1`.
  block.screenTransform.set(2 / width, 0, 0, -1, 0, 2 / height, 0, -1, 0, 0, 1, 0, 0, 0, 0, 1);
  transform2DMatrixInto(block.canvasNormalTransform, normalTransform(canvasTransform));
  const { r, g, b, a } = usesLinearColors ? srgbToLinearColor(canvasModulate) : canvasModulate;
  block.canvasModulation.set(r, g, b, a);
  writeViewport(block, frame);
  block.time = frame.time;
  block.usesPixelSnap = frame.snapVerticesToPixel;
  block.flags = usesLinearColors ? CONVERT_ATTRIBUTES_TO_LINEAR : 0;
}

/** Godot's render target is its viewport (`renderer_canvas_render_rd.cpp:701-702`), or the whole target. */
function writeViewport(block: CanvasDataBlock, { width, height, viewport }: CanvasFrame): void {
  if (!viewport) {
    block.screenPixelSize.set(1 / width, 1 / height);
    block.viewportInTarget.set(0, 0, 1, 1);
    return;
  }
  block.screenPixelSize.set(1 / viewport.width, 1 / viewport.height);
  block.viewportInTarget.set(viewport.x, viewport.y, 1 / viewport.scale, 1 / viewport.scale);
}

/** Each member of `CanvasData` the unlit variants read, by where Godot writes it. */
export const CANVAS_BINDINGS: readonly Binding<CanvasDataBlock>[] = [
  {
    uniform: `${DATA}.canvas_transform`,
    godot: 'renderer_canvas_render_rd.cpp:683',
    value: (block) => block.canvasTransform,
  },
  {
    uniform: `${DATA}.screen_transform`,
    godot: 'renderer_canvas_render_rd.cpp:679-682',
    value: (block) => block.screenTransform,
  },
  {
    uniform: `${DATA}.canvas_normal_transform`,
    godot: 'renderer_canvas_render_rd.cpp:685-689',
    value: (block) => block.canvasNormalTransform,
  },
  {
    uniform: `${DATA}.canvas_modulation`,
    godot: 'renderer_canvas_render_rd.cpp:691-698',
    value: (block) => block.canvasModulation,
  },
  {
    uniform: `${DATA}.screen_pixel_size`,
    godot: 'renderer_canvas_render_rd.cpp:700-702',
    value: (block) => block.screenPixelSize,
  },
  { uniform: `${DATA}.time`, godot: 'renderer_canvas_render_rd.cpp:704', value: (block) => block.time },
  {
    uniform: `${DATA}.use_pixel_snap`,
    godot: 'renderer_canvas_render_rd.cpp:705',
    value: (block) => block.usesPixelSnap,
  },
  { uniform: `${DATA}.directional_light_count`, godot: 'renderer_canvas_render_rd.cpp:707', value: () => 0 },
  { uniform: `${DATA}.flags`, godot: 'renderer_canvas_render_rd.cpp:729', value: (block) => block.flags },
];

/** Points the `CanvasData` uniforms of `draw` at `block`. Numbers are copied: bind before each draw. */
export function bindCanvasData(draw: CanvasDraw, block: CanvasDataBlock): void {
  writeBindings(CANVAS_BINDINGS, draw.uniforms, block);
  draw.viewportInTarget.value = block.viewportInTarget;
}

/** Written only by `writeCanvasBindings`: the block of each draw it writes, built on its first write. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const blocksOfDraws = new WeakMap<CanvasDraw, CanvasDataBlock>();

/** Writes each uniform of `draw` the binding table names, from `frame`. */
export function writeCanvasBindings(draw: CanvasDraw, frame: CanvasFrame): void {
  let block = blocksOfDraws.get(draw);
  if (!block) blocksOfDraws.set(draw, (block = canvasDataBlock()));
  writeCanvasData(block, frame);
  bindCanvasData(draw, block);
}

/** `_update_transform_2d_to_mat4` (`renderer_canvas_render_rd.cpp:45`): the axes and origin in x and y. */
function transform2DMatrixInto(
  out: THREE.Matrix4,
  { a, b, c, d, tx, ty }: Transform2DColumns
): THREE.Matrix4 {
  return out.set(a, c, 0, tx, b, d, 0, ty, 0, 0, 1, 0, 0, 0, 0, 1);
}

/** The canvas transform's axes made unit length, with no origin. */
function normalTransform({ a, b, c, d }: Transform2DColumns): Transform2DColumns {
  const x = normalizedVector2({ x: a, y: b });
  const y = normalizedVector2({ x: c, y: d });
  return { a: x.x, b: x.y, c: y.x, d: y.y, tx: 0, ty: 0 };
}
