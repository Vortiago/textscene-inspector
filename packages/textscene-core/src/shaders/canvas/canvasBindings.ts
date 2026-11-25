import * as THREE from 'three';
import { srgbToLinearColor } from '../../godot/math/color.js';
import type { Rgba } from '../../godot/math/math.js';
import type { Transform2DColumns } from '../../godot/math/transform2d.js';
import { normalizedVector2 } from '../../godot/math/vector.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import type { CanvasDraw } from './transpileCanvas.js';

/** What a canvas draw reads from its viewport, with no light. */
export interface CanvasFrame {
  /** The size of the render target in pixels. */
  readonly width: number;
  readonly height: number;
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

/** Each member of `CanvasData` the unlit variants read (`renderer_canvas_render_rd.cpp:673-729`). */
export const CANVAS_BINDINGS: readonly Binding<CanvasFrame>[] = [
  {
    uniform: `${DATA}.canvas_transform`,
    godot: 'renderer_canvas_render_rd.cpp:683',
    value: (frame) => transform2DMatrix(frame.canvasTransform),
  },
  {
    uniform: `${DATA}.screen_transform`,
    godot: 'renderer_canvas_render_rd.cpp:679-682',
    value: (frame) => screenTransform(frame.width, frame.height),
  },
  {
    uniform: `${DATA}.canvas_normal_transform`,
    godot: 'renderer_canvas_render_rd.cpp:685-689',
    value: (frame) => transform2DMatrix(normalTransform(frame.canvasTransform)),
  },
  {
    uniform: `${DATA}.canvas_modulation`,
    godot: 'renderer_canvas_render_rd.cpp:691-698',
    value: ({ canvasModulate, usesLinearColors }) => {
      const { r, g, b, a } = usesLinearColors ? srgbToLinearColor(canvasModulate) : canvasModulate;
      return new THREE.Vector4(r, g, b, a);
    },
  },
  {
    uniform: `${DATA}.screen_pixel_size`,
    godot: 'renderer_canvas_render_rd.cpp:700-702',
    value: (frame) => new THREE.Vector2(1 / frame.width, 1 / frame.height),
  },
  { uniform: `${DATA}.time`, godot: 'renderer_canvas_render_rd.cpp:704', value: (frame) => frame.time },
  {
    uniform: `${DATA}.use_pixel_snap`,
    godot: 'renderer_canvas_render_rd.cpp:705',
    value: (frame) => frame.snapVerticesToPixel,
  },
  { uniform: `${DATA}.directional_light_count`, godot: 'renderer_canvas_render_rd.cpp:707', value: () => 0 },
  {
    uniform: `${DATA}.flags`,
    godot: 'renderer_canvas_render_rd.cpp:729',
    value: (frame) => (frame.usesLinearColors ? CONVERT_ATTRIBUTES_TO_LINEAR : 0),
  },
];

/** Writes each uniform of `draw` the binding table names, from `frame`. */
export function writeCanvasBindings(draw: CanvasDraw, frame: CanvasFrame): void {
  writeBindings(CANVAS_BINDINGS, draw.uniforms, frame);
}

/**
 * `_update_transform_2d_to_mat4` (`renderer_canvas_render_rd.cpp:45`): the axes and origin in x and y.
 * @canonical A Transform2D as the column-major mat4 a canvas template reads
 */
export function transform2DMatrix({ a, b, c, d, tx, ty }: Transform2DColumns): THREE.Matrix4 {
  return new THREE.Matrix4().set(a, c, 0, tx, b, d, 0, ty, 0, 0, 1, 0, 0, 0, 0, 1);
}

/** Pixels to Vulkan's clip space, y down: `x * 2 / width - 1`. */
function screenTransform(width: number, height: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(2 / width, 0, 0, -1, 0, 2 / height, 0, -1, 0, 0, 1, 0, 0, 0, 0, 1);
}

/** The canvas transform's axes made unit length, with no origin. */
function normalTransform({ a, b, c, d }: Transform2DColumns): Transform2DColumns {
  const x = normalizedVector2({ x: a, y: b });
  const y = normalizedVector2({ x: c, y: d });
  return { a: x.x, b: x.y, c: y.x, d: y.y, tx: 0, ty: 0 };
}
