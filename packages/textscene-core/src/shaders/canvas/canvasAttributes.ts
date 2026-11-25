import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math.js';
import { stripToTriangles, triangulatePolygon } from '../../godot/math/triangulate.js';
import { multiplyTransform2D, type Transform2DColumns } from '../../godot/math/transform2d.js';
import type { Vector2 } from '../../godot/math/vector.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import type { CanvasPrimitive } from './canvasPrimitive.js';
import { type CanvasItemDraw, modulated, NO_INSTANCE_UNIFORMS, WHITE, worldOf } from './canvasInstance.js';
import { emulatedPointGeometry } from '../spatial/meshAttributes.js';
import {
  CUSTOM_ARRAY_LANES,
  customArrayAttribute,
  customArrayTemplateAttribute,
  VERTEX_ID_ATTRIBUTE,
} from '../template/surfaceAttributes.js';
import type { CanvasDraw, CanvasVariant } from './transpileCanvas.js';

/** The vertex arrays of `Item::CommandPolygon`, or of one surface of a mesh. */
export interface CanvasVertexArrays {
  readonly primitive: CanvasPrimitive;
  /** The index array, or nothing for vertices drawn in order. */
  readonly indices?: readonly number[];
  readonly points: readonly Vector2[];
  /** One colour for each point, one for all of them, or none for white. */
  readonly colors: readonly Rgba[];
  /** One UV for each point, or none for zero. */
  readonly uvs: readonly Vector2[];
  /** CUSTOM0 and CUSTOM1 as the vertex stage reads them, four lanes per point, each undefined when absent. */
  readonly customs?: readonly (Float32Array | undefined)[];
}

/** `canvas_item_add_polygon` (`renderer_canvas_cull.cpp:1715`): the outline cut into triangles. */
export function polygonCommand(
  points: readonly Vector2[],
  colors: readonly Rgba[],
  uvs: readonly Vector2[]
): CanvasVertexArrays {
  const indices = triangulatePolygon(points);
  if (indices.length === 0)
    throw new Error(`expected a polygon that triangulates, got ${points.length} points with no triangle`);
  return triangleArrayCommand(indices, points, colors, uvs);
}

/** `canvas_item_add_triangle_array` (`renderer_canvas_cull.cpp:1736`), as Polygon2D draws one. */
export function triangleArrayCommand(
  indices: readonly number[],
  points: readonly Vector2[],
  colors: readonly Rgba[],
  uvs: readonly Vector2[]
): CanvasVertexArrays {
  return checkedArrays({ primitive: 'triangles', indices, points, colors, uvs });
}

function checkedArrays(arrays: CanvasVertexArrays): CanvasVertexArrays {
  const { points, colors, uvs } = arrays;
  const isColorCountValid = colors.length === 0 || colors.length === 1 || colors.length === points.length;
  if (!isColorCountValid || (uvs.length !== 0 && uvs.length !== points.length))
    throw new Error(
      `expected 0, 1 or ${points.length} colours and 0 or ${points.length} UVs, got ${colors.length} and ${uvs.length}`
    );
  arrays.customs?.forEach((lanes, custom) => {
    if (lanes && lanes.length !== points.length * CUSTOM_ARRAY_LANES)
      throw new Error(
        `expected ${points.length * CUSTOM_ARRAY_LANES} lanes in CUSTOM${custom}, got ${lanes.length}`
      );
  });
  return arrays;
}

/** The variant of a draw of `primitive` (`renderer_canvas_render_rd.cpp:2638, 3195`). */
export function attributesVariant(primitive: CanvasPrimitive): CanvasVariant {
  return primitive === 'points' ? 'attributes_points' : 'attributes';
}

/** The custom arrays of a surface geometry that the template reads, CUSTOM0 first (`canvas.glsl:12-18`). */
export const CANVAS_CUSTOM_ARRAYS = [0, 1].map(customArrayAttribute);

/** The default vertex buffers of a missing array (`mesh_storage.cpp:86-157`). */
const DEFAULT_COLOR = [1, 1, 1, 1];
const DEFAULT_UV = [0, 0];

/**
 * `request_polygon` (`renderer_canvas_render_rd.cpp:104-300`), a missing array as its default buffer.
 * @canonical The vertex attributes of a canvas polygon or mesh surface
 */
export function attributesGeometry(arrays: CanvasVertexArrays): THREE.BufferGeometry {
  const { points, colors, uvs, indices } = checkedArrays(arrays);
  const count = points.length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'vertex_attrib',
    floats(
      points.flatMap(({ x, y }) => [x, y]),
      2
    )
  );
  const colorOf = (index: number) => colors[colors.length === 1 ? 0 : index];
  const colorValues = colors.length > 0 ? points.flatMap((_, index) => channels(colorOf(index)!)) : null;
  geometry.setAttribute('color_attrib', floats(colorValues ?? repeated(DEFAULT_COLOR, count), 4));
  const uvValues = uvs.length === count ? uvs.flatMap(({ x, y }) => [x, y]) : repeated(DEFAULT_UV, count);
  geometry.setAttribute('uv_attrib', floats(uvValues, 2));
  CANVAS_CUSTOM_ARRAYS.forEach((_, custom) => {
    // A missing custom array reads zero (`mesh_storage.cpp:120-131`).
    const values = arrays.customs?.[custom] ?? new Float32Array(count * CUSTOM_ARRAY_LANES);
    geometry.setAttribute(
      customArrayTemplateAttribute(custom),
      new THREE.BufferAttribute(values, CUSTOM_ARRAY_LANES)
    );
  });
  if (arrays.primitive === 'points')
    geometry.setAttribute(
      VERTEX_ID_ATTRIBUTE,
      new THREE.BufferAttribute(Float32Array.from(points.keys()), 1)
    );
  geometry.setAttribute('bone_attrib', new THREE.BufferAttribute(new Uint32Array(count * 4), 4));
  geometry.setAttribute('weight_attrib', new THREE.BufferAttribute(new Float32Array(count * 4), 4));
  // In order without indices: three counts the vertices of an unindexed draw from `position` alone.
  const order = indices ?? points.map((_, index) => index);
  // WebGL 2 draws no strip of a three `Mesh`, so a strip draws as the triangles it makes.
  geometry.setIndex(arrays.primitive === 'triangle_strip' ? [...stripToTriangles(order)] : [...order]);
  // The template places each vertex through the push constants, so `position` bounds nothing.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return geometry;
}

const floats = (values: number[], size: number) => new THREE.BufferAttribute(new Float32Array(values), size);
const channels = ({ r, g, b, a }: Rgba) => [r, g, b, a];
const repeated = (value: readonly number[], count: number) =>
  Array.from({ length: count }, () => value).flat();

/** `PushConstantAttributes` past `PushConstant` (`renderer_canvas_render_rd.h:391-398`), with no light. */
export interface AttributesConstants {
  readonly world: Transform2DColumns;
  readonly modulation: Rgba;
}

/** The item's transform and modulate (`renderer_canvas_render_rd.cpp:2643-2654`). */
export function polygonConstants(item: CanvasItemDraw): AttributesConstants {
  return { world: item.transform, modulation: modulated(WHITE, item) };
}

/** `Item::CommandMesh` past its mesh: `draw_mesh`'s transform and modulate. */
export interface CanvasMeshPlacement {
  readonly transform: Transform2DColumns;
  readonly modulate: Rgba;
}

/** A mesh's push constants (`renderer_canvas_render_rd.cpp:2764-2855`). */
export function meshConstants(item: CanvasItemDraw, mesh: CanvasMeshPlacement): AttributesConstants {
  return {
    world: multiplyTransform2D(item.transform, mesh.transform),
    modulation: modulated(mesh.modulate, item),
  };
}

/** The vector members of `Params`, one set for each draw, which each object's hook sets in place. */
interface AttributesParams {
  readonly worldX: THREE.Vector2;
  readonly worldY: THREE.Vector2;
  readonly worldOfs: THREE.Vector2;
  readonly modulation: THREE.Vector4;
}

const newParams = (): AttributesParams => ({
  worldX: new THREE.Vector2(),
  worldY: new THREE.Vector2(),
  worldOfs: new THREE.Vector2(),
  modulation: new THREE.Vector4(),
});

function setParams(
  params: AttributesParams,
  { world, modulation: { r, g, b, a } }: AttributesConstants
): void {
  const [xx, xy, yx, yy, ox, oy] = worldOf(world);
  params.worldX.set(xx!, xy!);
  params.worldY.set(yx!, yy!);
  params.worldOfs.set(ox!, oy!);
  params.modulation.set(r, g, b, a);
}

const NO_LIGHTS = new THREE.Vector4();

/** Each member of `Params` an attributes draw writes (`renderer_canvas_render_rd.cpp:567`). */
const ATTRIBUTES_BINDINGS: readonly Binding<AttributesParams>[] = [
  { uniform: 'params.world_x', godot: 'renderer_canvas_render_rd.cpp:570', value: ({ worldX }) => worldX },
  { uniform: 'params.world_y', godot: 'renderer_canvas_render_rd.cpp:570', value: ({ worldY }) => worldY },
  {
    uniform: 'params.world_ofs',
    godot: 'renderer_canvas_render_rd.cpp:570',
    value: ({ worldOfs }) => worldOfs,
  },
  {
    uniform: 'params.modulation',
    godot: 'renderer_canvas_render_rd.cpp:571',
    value: ({ modulation }) => modulation,
  },
  // No light reaches the item, so its flags and light indices are zero.
  { uniform: 'params.flags', godot: 'renderer_canvas_render_rd.cpp:573', value: () => 0 },
  { uniform: 'params.lights', godot: 'renderer_canvas_render_rd.cpp:572', value: () => NO_LIGHTS },
  {
    uniform: 'params.instance_uniforms_ofs',
    godot: 'renderer_canvas_render_rd.cpp:574',
    value: () => NO_INSTANCE_UNIFORMS,
  },
];

/** The uniform every attributes vertex stage reads, so its object update runs before each draw. */
const DRAW_HOOK = 'params.world_x';

/** The `userData` key of an object's constants: `Object3D.copy` copies it, so a clone draws as its source. */
const CONSTANTS_KEY = 'attributesConstants';

function constantsOf(object: THREE.Object3D): AttributesConstants {
  const constants = object.userData[CONSTANTS_KEY] as AttributesConstants | undefined;
  if (!constants)
    throw new Error(`expected an object of attributesObject, got ${object.name || object.uuid}`);
  return constants;
}

/** Written only by `writeEachDraw`: the draws whose hook writes each object's constants. */
const hookedDraws = new WeakSet<CanvasDraw>();

/** An object that draws `geometry` as `primitive` with `draw`. The caller disposes `object.geometry` too. */
export function attributesObject(
  draw: CanvasDraw,
  geometry: THREE.BufferGeometry,
  primitive: CanvasPrimitive,
  constants: AttributesConstants
): PrimitiveObject {
  writeEachDraw(draw);
  if (draw.emulatesPoints && primitive !== 'points')
    throw new Error(`expected points for a draw that emulates points, got ${primitive}`);
  const object = draw.emulatesPoints
    ? primitiveObject('triangles', emulatedPointGeometry(geometry), draw.material)
    : primitiveObject(primitive, geometry, draw.material);
  object.userData[CONSTANTS_KEY] = constants;
  return object;
}

/** Writes the push constants of each object before it draws: a polygon is a batch of its own. */
function writeEachDraw(draw: CanvasDraw): void {
  if (hookedDraws.has(draw)) return;
  const hook = draw.uniforms.get(DRAW_HOOK);
  if (!hook || !('onObjectUpdate' in hook))
    throw new Error(
      `expected an attributes draw to read the uniform ${DRAW_HOOK}, found ${hook ? 'an array' : 'none'}`
    );
  hookedDraws.add(draw);
  const params = newParams();
  hook.onObjectUpdate(({ object }) => {
    setParams(params, constantsOf(object!));
    writeBindings(ATTRIBUTES_BINDINGS, draw.uniforms, params);
  });
}

/** The three object of one canvas primitive type. */
export type PrimitiveObject = THREE.Mesh | THREE.Points | THREE.Line;

/**
 * `RD::RenderPrimitive` (`renderer_canvas_render_rd.cpp:355`), a strip's geometry already cut into triangles.
 * @canonical The three object that draws a canvas primitive type
 */
export function primitiveObject(
  primitive: CanvasPrimitive,
  geometry: THREE.BufferGeometry,
  material: THREE.Material
): PrimitiveObject {
  const object = objectOf(primitive, geometry, material);
  object.frustumCulled = false;
  return object;
}

function objectOf(
  primitive: CanvasPrimitive,
  geometry: THREE.BufferGeometry,
  material: THREE.Material
): PrimitiveObject {
  switch (primitive) {
    case 'points':
      return new THREE.Points(geometry, material);
    case 'lines':
      return new THREE.LineSegments(geometry, material);
    case 'line_strip':
      return new THREE.Line(geometry, material);
    case 'triangles':
    case 'triangle_strip':
      return new THREE.Mesh(geometry, material);
  }
}
