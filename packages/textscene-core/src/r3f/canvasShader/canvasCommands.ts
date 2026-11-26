import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { rect2Intersection, type Rect2 } from '../../godot/math/rect2';
import { bottomUpV } from '../../godot/math/uv';
import {
  equalTransform2D,
  multiplyTransform2DInto,
  mutableTransform2D,
  TRANSFORM2D_IDENTITY,
  type MutableTransform2D,
  type Transform2DColumns,
} from '../../godot/math/transform2d';
import type { Vector2 } from '../../godot/math/vector';
import {
  CANVAS_CUSTOM_ARRAYS,
  CUSTOM_ARRAY_LANES,
  fourCustomLanes,
} from '../../godot/rendering/meshArrayFormat';
import { geometryPrimitive } from '../../resources/meshes/godotSurface';
import type { MultiMeshInstance } from '../../resources/meshes/multimesh';
import type { AtlasCellRects } from '../../resources/useTexture2D';
import type { CanvasVertexArrays } from '../../shaders/canvas/canvasAttributes';
import { canvasInstances, type CanvasInstances } from '../../shaders/canvas/canvasMultiMesh';
import { customArrayAttribute } from '../../shaders/template/surfaceAttributes';
import { setGeometryBoxBound } from '../bounds';
import { transform2DFromThreeMatrix } from '../node2dTransform';
import type { CanvasSurface } from '../canvasMesh/canvasSurface';

/** `canvas_item_add_texture_rect_region` with a white modulate (`renderer_canvas_cull.cpp:1624`). */
export interface CanvasRectRegion {
  /** In the item's pixels. */
  readonly rect: Rect2;
  /** In the texture's texels. */
  readonly source: Rect2;
  readonly clipUv: boolean;
  /** Whether the texture's x runs along the rect's y, as a transposed tile draws. */
  readonly transpose?: boolean;
}

/** `AtlasTexture::get_rect_region` (`atlas_texture.cpp:193-224`): the rect on the atlas, or null for none. */
export function atlasRectRegion(
  { rect, source, transpose }: CanvasRectRegion,
  atlas: AtlasCellRects
): CanvasRectRegion | null {
  const { cell, region } = atlas;
  const size = source.w === 0 && source.h === 0 ? { w: region.w, h: region.h } : { w: source.w, h: source.h };
  const scaleX = rect.w / size.w;
  const scaleY = rect.h / size.h;
  const moved = { x: source.x + cell.x, y: source.y + cell.y, ...size };
  const clipped = rect2Intersection(
    { x: cell.x + region.x, y: cell.y + region.y, w: region.w, h: region.h },
    moved
  );
  if (clipped.w === 0 && clipped.h === 0) return null;
  const offsetX = clipped.x - moved.x + (scaleX < 0 ? clipped.w - moved.w : 0);
  const offsetY = clipped.y - moved.y + (scaleY < 0 ? clipped.h - moved.h : 0);
  return {
    rect: {
      x: rect.x + offsetX * scaleX,
      y: rect.y + offsetY * scaleY,
      w: clipped.w * scaleX,
      h: clipped.h * scaleY,
    },
    source: clipped,
    clipUv: atlas.filterClip,
    ...(transpose && { transpose }),
  };
}

/** A mesh or multimesh command: its arrays, and where it sits in the item. */
interface CanvasMeshCommand {
  readonly arrays: CanvasVertexArrays;
  /** `CommandMesh::transform` (`renderer_canvas_render_rd.cpp:2767`), the identity when absent. */
  readonly transform?: Transform2DColumns;
  /** Receives the object that draws the arrays, which a skin deforms before each render. */
  readonly meshRef?: (drawn: THREE.Object3D | null) => void;
}

/** An item's command that a canvas_item shader draws through Godot's canvas template. */
export type CanvasShaderCommand =
  | { readonly kind: 'rect'; readonly region: CanvasRectRegion; readonly modulate: Rgba }
  | ({ readonly kind: 'mesh' } & CanvasMeshCommand)
  | ({ readonly kind: 'multimesh'; readonly instances: CanvasInstances } & CanvasMeshCommand);

/** Scratch of one corner, overwritten by the next. */
const corner = new THREE.Vector3();

/**
 * Bounds `object` by the item rect of `commands` in a new box, which a canvas group's region reads.
 * @canonical Bound a canvas shader batch by its item rect
 */
export function boundByItem(
  object: THREE.Object3D & { geometry: THREE.BufferGeometry },
  commands: readonly CanvasShaderCommand[]
): THREE.Box3 {
  setGeometryBoxBound(object, true);
  return (object.geometry.boundingBox = itemBox(new THREE.Box3(), commands));
}

/**
 * Writes the item rect of `commands` to `box`, which the caller owns.
 * @canonical The item rect of canvas shader commands as a box
 */
export function itemBox(box: THREE.Box3, commands: readonly CanvasShaderCommand[]): THREE.Box3 {
  box.makeEmpty();
  for (const command of commands) growItemBox(box, command);
  return box;
}

/** Grows `box` by `command` as `Item::get_rect` does (`renderer_canvas_render.cpp:59-86`), with three's y. */
function growItemBox(box: THREE.Box3, command: CanvasShaderCommand): void {
  if (command.kind === 'rect') {
    const { x, y, w, h } = command.region.rect;
    box.expandByPoint(corner.set(x, -y, 0));
    box.expandByPoint(corner.set(x + w, -(y + h), 0));
    return;
  }
  const { transform = TRANSFORM2D_IDENTITY } = command;
  if (command.kind === 'mesh') {
    for (const point of command.arrays.points) growByPoint(box, transform, point);
    return;
  }
  // The mesh's rect at each instance, as `multimesh_get_aabb` bounds it.
  const { min, max } = pointsBox(meshRect, command.arrays.points);
  if (meshRect.isEmpty()) return;
  const { count, words } = command.instances;
  const floats = new Float32Array(words.buffer, words.byteOffset, words.length);
  const stride = floats.length / count;
  for (let instance = 0; instance < count; instance++) {
    const placed = instanceTransformInto(instancePlacement, floats, instance * stride);
    multiplyTransform2DInto(placed, transform, placed);
    growByPoint(box, placed, min);
    growByPoint(box, placed, max);
    growByPoint(box, placed, point.set(min.x, max.y));
    growByPoint(box, placed, point.set(max.x, min.y));
  }
}

/** Scratch of the mesh rect of one multimesh command, overwritten by the next. */
const meshRect = new THREE.Box2();

/** Scratch of one instance's placement, overwritten by the next. */
const instancePlacement = mutableTransform2D();

/** Grows `box` by `point` of Godot's frame, placed by `transform`, in three's y. */
function growByPoint(box: THREE.Box3, transform: Transform2DColumns, { x, y }: Vector2): void {
  const { a, b, c, d, tx, ty } = transform;
  box.expandByPoint(corner.set(a * x + c * y + tx, 0 - (b * x + d * y + ty), 0));
}

/** Writes the box of `points` in Godot's frame to `box`, which the caller owns. */
function pointsBox(box: THREE.Box2, points: readonly Vector2[]): THREE.Box2 {
  box.makeEmpty();
  for (const { x, y } of points) box.expandByPoint(point.set(x, y));
  return box;
}

/** Scratch of one point, overwritten by the next. */
const point = new THREE.Vector2();

/** The `TRANSFORM_2D` rows at `offset` (`mesh_storage.cpp:1927-1934`) as a transform, written into `out`. */
function instanceTransformInto(
  out: MutableTransform2D,
  rows: Float32Array,
  offset: number
): MutableTransform2D {
  out.a = rows[offset]!;
  out.c = rows[offset + 1]!;
  out.tx = rows[offset + 3]!;
  out.b = rows[offset + 4]!;
  out.d = rows[offset + 5]!;
  out.ty = rows[offset + 7]!;
  return out;
}

/** Each surface white (`polygon_2d.cpp:401`), at the transform its placement gives. */
export function surfaceCommands(surfaces: readonly CanvasSurface[]): CanvasShaderCommand[] {
  return surfaces.map((surface) => ({
    kind: 'mesh',
    arrays: vertexArraysOf(surface.geometry, surface.arrayColor, THREE_FRAME_Y),
    ...placedCommand(surface),
  }));
}

/** The command of each mesh geometry, read from the source: its y already runs down, as Godot's. */
export function meshCommands(geometries: readonly THREE.BufferGeometry[]): CanvasShaderCommand[] {
  return geometries.map((geometry) => ({
    kind: 'mesh',
    arrays: vertexArraysOf(geometry, undefined, GODOT_FRAME_Y),
  }));
}

/** A multimesh command a surface, each of every instance (`renderer_canvas_render_rd.cpp:3187-3212`). */
export function multiMeshCommands(
  geometries: readonly THREE.BufferGeometry[],
  instances: readonly MultiMeshInstance[],
  transform?: Transform2DColumns
): CanvasShaderCommand[] {
  if (instances.length === 0) return [];
  const drawn = canvasInstances(instances);
  return geometries.map((geometry) => ({
    kind: 'multimesh',
    arrays: vertexArraysOf(geometry, undefined, GODOT_FRAME_Y),
    instances: drawn,
    ...(transform && { transform }),
  }));
}

/** The sign that turns a geometry's y into Godot's, which runs down: three's runs up. */
const THREE_FRAME_Y = -1;
const GODOT_FRAME_Y = 1;

/** Scratch of one placement, overwritten by the next. */
const placement = new THREE.Matrix4();
const UNSCALED: [number, number, number] = [1, 1, 1];
const ORIGIN: [number, number, number] = [0, 0, 0];

/** A surface's placement in three's frame as Godot's transform, and its skin's receiver. */
function placedCommand({ position, scale, matrix, meshRef }: CanvasSurface): Partial<CanvasMeshCommand> {
  const placed =
    matrix ??
    (position || scale
      ? placement.makeScale(...(scale ?? UNSCALED)).setPosition(...(position ?? ORIGIN))
      : null);
  return {
    ...(placed && { transform: transform2DFromThreeMatrix(placed) }),
    ...(meshRef && { meshRef }),
  };
}

/** The arrays of a geometry in Godot's frame, its y times `ySign`, v down from the top. */
function vertexArraysOf(
  geometry: THREE.BufferGeometry,
  arrayColor: Rgba | undefined,
  ySign: number
): CanvasVertexArrays {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const color = geometry.getAttribute('color');
  const points: Vector2[] = [];
  const uvs: Vector2[] = [];
  const colors: Rgba[] = arrayColor && !color ? [arrayColor] : [];
  for (let i = 0; i < position.count; i++) {
    points.push({ x: position.getX(i), y: ySign * position.getY(i) });
    if (uv) uvs.push({ x: uv.getX(i), y: bottomUpV(uv.getY(i)) });
    if (color)
      colors.push({
        r: color.getX(i),
        g: color.getY(i),
        b: color.getZ(i),
        a: color.itemSize === 4 ? color.getW(i) : 1,
      });
  }
  const index = geometry.getIndex();
  const customs = CANVAS_CUSTOM_ARRAYS.map((custom) => customLanes(geometry, customArrayAttribute(custom)));
  return {
    primitive: geometryPrimitive(geometry),
    ...(index && { indices: Array.from(index.array) }),
    points,
    colors,
    uvs,
    ...(customs.some(Boolean) && { customs }),
  };
}

/** The custom array `name` in four float lanes a point: its own array when it holds them, else a copy. */
function customLanes(geometry: THREE.BufferGeometry, name: string): Float32Array | undefined {
  const attribute = geometry.getAttribute(name);
  if (!attribute) return undefined;
  // Shared, not copied: the surface loader writes four float lanes once, and a draw only reads them.
  if (isFourFloatLanes(attribute)) return attribute.array;
  return fourCustomLanes(attribute.count, Math.min(attribute.itemSize, CUSTOM_ARRAY_LANES), (point, lane) =>
    attribute.getComponent(point, lane)
  );
}

const isFourFloatLanes = (
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): attribute is THREE.BufferAttribute & { array: Float32Array } =>
  !(attribute as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute &&
  attribute.itemSize === CUSTOM_ARRAY_LANES &&
  attribute.array instanceof Float32Array &&
  attribute.array.length === attribute.count * CUSTOM_ARRAY_LANES;

/** Whether two command lists draw the same batches: the kinds, mesh arrays, places, receivers and counts. */
export function sameCommandLayout(
  a: readonly CanvasShaderCommand[],
  b: readonly CanvasShaderCommand[]
): boolean {
  return (
    a.length === b.length &&
    a.every((command, index) => {
      const other = b[index]!;
      if (command.kind === 'rect') return other.kind === 'rect';
      if (other.kind !== command.kind || other.arrays !== command.arrays) return false;
      if (other.meshRef !== command.meshRef) return false;
      if (!samePlace(command.transform, other.transform)) return false;
      return instanceCountOf(command) === instanceCountOf(other);
    })
  );
}

function samePlace(p: Transform2DColumns | undefined, q: Transform2DColumns | undefined): boolean {
  return p === q || (p !== undefined && q !== undefined && equalTransform2D(p, q));
}

/** How many times a command draws its arrays: once for a mesh or a rect. */
function instanceCountOf(command: CanvasShaderCommand): number {
  return command.kind === 'multimesh' ? command.instances.count : 1;
}
