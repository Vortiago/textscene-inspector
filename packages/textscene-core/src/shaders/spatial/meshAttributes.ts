import * as THREE from 'three';
import { encodedNormalTangent } from '../../godot/rendering/meshNormalTangent.js';
import { storedLanes } from '../storedLanes.js';

/** The attribute the scene template reads at location 0: the position, which GL widens with w = 1. */
const VERTEX_ANGLE_ATTRIBUTE = 'vertex_angle_attrib';

/** The attribute at location 1: the normal and the tangent as four 16-bit unsigned normalised lanes. */
const AXIS_TANGENT_ATTRIBUTE = 'axis_tangent_attrib';

/** The `userData` key of a turned primitive's corner count, which `clone` carries. A new index deletes it. */
const FIRST_CORNER_LAST = 'godotFirstCornerLast';

/** The primitive a surface draws: a line strip is drawn as its list of lines. */
export type GodotPrimitive = 'triangles' | 'lines' | 'points';

/** The corners of each primitive that a `flat` value is read across, and the list's name in a fault. */
const LISTS = { triangles: { corners: 3, name: 'triangle' }, lines: { corners: 2, name: 'line' } } as const;

/** `geometry` as an uncompressed Godot surface (`rendering_server.cpp:425-700`), first corners as Godot's. */
export function withGodotAttributes(
  geometry: THREE.BufferGeometry,
  primitive: GodotPrimitive = 'triangles'
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('expected a geometry with a position attribute, found none');
  if (primitive !== 'points' && !geometry.userData[FIRST_CORNER_LAST])
    withFirstCornerLast(geometry, position.count, primitive);
  geometry.setAttribute(VERTEX_ANGLE_ATTRIBUTE, position);
  const normal = geometry.getAttribute('normal');
  if (normal) geometry.setAttribute(AXIS_TANGENT_ATTRIBUTE, axisTangent(normal, signedTangent(geometry)));
  const color = geometry.getAttribute('color');
  if (color) geometry.setAttribute('color_attrib', rgba8(color));
  // three names the second UV set `uv1`.
  for (const [three, godot] of [
    ['uv', 'uv_attrib'],
    ['uv1', 'uv2_attrib'],
  ] as const) {
    const uv = geometry.getAttribute(three);
    if (uv) geometry.setAttribute(godot, uv);
  }
  for (let custom = 0; custom < CUSTOM_ARRAYS; custom++) {
    const values = geometry.getAttribute(`custom${custom}`);
    if (values) geometry.setAttribute(`custom${custom}_attrib`, values);
  }
  const bones = geometry.getAttribute('skinIndex');
  if (bones) geometry.setAttribute('bone_attrib', boneIndices(bones));
  const weights = geometry.getAttribute('skinWeight');
  if (weights) geometry.setAttribute('weight_attrib', weights);
  for (const [name, value] of Object.entries(MISSING_ARRAY_VALUES))
    if (!geometry.getAttribute(name)) geometry.setAttribute(name, constantAttribute(value));
  return geometry;
}

/** The value of each array a surface lacks: Godot's default vertex buffers (`mesh_storage.cpp:61-157`). */
const MISSING_ARRAY_VALUES: Readonly<Record<string, Float32Array | Uint32Array>> = {
  // A normal of three floats, read with GL's last lane of 1.
  [AXIS_TANGENT_ATTRIBUTE]: Float32Array.of(1, 0, 0, 1),
  color_attrib: Float32Array.of(1, 1, 1, 1),
  uv_attrib: Float32Array.of(0, 0, 0, 0),
  uv2_attrib: Float32Array.of(0, 0, 0, 0),
  custom0_attrib: Float32Array.of(0, 0, 0, 0),
  custom1_attrib: Float32Array.of(0, 0, 0, 0),
  custom2_attrib: Float32Array.of(0, 0, 0, 0),
  custom3_attrib: Float32Array.of(0, 0, 0, 0),
  bone_attrib: Uint32Array.of(0, 0, 0, 0),
  weight_attrib: Float32Array.of(0, 0, 0, 0),
};

/** One value for all vertices like Godot's stride-0 buffer: GL reads instance 0 when nothing is instanced. */
function constantAttribute(value: Float32Array | Uint32Array): THREE.InstancedBufferAttribute {
  return new THREE.InstancedBufferAttribute(value, 4);
}

/** `Mesh::ARRAY_CUSTOM0` to `ARRAY_CUSTOM3`, which this reads from the attributes `custom0` to `custom3`. */
const CUSTOM_ARRAYS = 4;

/** The bone indices as Godot stores them, four 16-bit unsigned integers that GL reads as integers. */
function boneIndices(bones: Attribute): THREE.BufferAttribute {
  if (bones.itemSize !== 4) throw new Error(`expected 4 bone indices a vertex, got ${bones.itemSize}`);
  const lanes = new Uint16Array(bones.count * 4);
  for (let vertex = 0; vertex < bones.count; vertex++)
    lanes.set([bones.getX(vertex), bones.getY(vertex), bones.getZ(vertex), bones.getW(vertex)], vertex * 4);
  const attribute = new THREE.BufferAttribute(lanes, 4);
  attribute.gpuType = THREE.IntType;
  return attribute;
}

/** Each primitive turned to draw its first corner last: `flat` reads Vulkan's first vertex, WebGL's last. */
function withFirstCornerLast(
  geometry: THREE.BufferGeometry,
  vertexCount: number,
  primitive: 'triangles' | 'lines'
): void {
  const index = geometry.getIndex()?.array;
  const cornerCount = index?.length ?? vertexCount;
  const { corners, name: list } = LISTS[primitive];
  if (cornerCount % corners !== 0)
    throw new Error(
      `expected a ${list} list of a multiple of ${corners} corners, got ${cornerCount} corners`
    );
  const turned = vertexCount > 0xffff ? new Uint32Array(cornerCount) : new Uint16Array(cornerCount);
  for (let corner = 0; corner < cornerCount; corner++) {
    const source = corner - (corner % corners) + (((corner % corners) + 1) % corners);
    turned[corner] = index ? index[source]! : source;
  }
  geometry.setIndex(new THREE.BufferAttribute(turned, 1));
  geometry.userData[FIRST_CORNER_LAST] = corners;
}

/** A colour as Godot stores it, four bytes cut down from 255 times each lane (`rendering_server.cpp:712`). */
function rgba8(color: Attribute): THREE.BufferAttribute {
  const lanes = new Uint8Array(color.count * 4);
  const byte = (value: number) => Math.trunc(Math.min(Math.max(Math.fround(value) * 255, 0), 255));
  for (let vertex = 0; vertex < color.count; vertex++) {
    // Alpha 1 where three's colour has three lanes.
    const alpha = color.itemSize === 4 ? color.getW(vertex) : 1;
    lanes.set([color.getX(vertex), color.getY(vertex), color.getZ(vertex), alpha].map(byte), vertex * 4);
  }
  return new THREE.BufferAttribute(lanes, 4, true);
}

/** The tangent attribute, whose fourth lane holds the binormal's sign. */
function signedTangent(geometry: THREE.BufferGeometry): Attribute | undefined {
  const tangent = geometry.getAttribute('tangent');
  if (tangent && tangent.itemSize !== 4)
    throw new Error(`expected a tangent of 4 lanes with the binormal's sign last, got ${tangent.itemSize}`);
  return tangent;
}

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

function axisTangent(normal: Attribute, tangent: Attribute | undefined): THREE.BufferAttribute {
  const lanes = new Uint16Array(normal.count * 4);
  for (let vertex = 0; vertex < normal.count; vertex++) {
    const normalOf = [normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex)];
    const tangentOf = tangent && [
      tangent.getX(vertex),
      tangent.getY(vertex),
      tangent.getZ(vertex),
      tangent.getW(vertex),
    ];
    lanes.set(encodedNormalTangent(normalOf, tangentOf), vertex * 4);
  }
  return new THREE.BufferAttribute(lanes, 4, true);
}

/** The vertices a point quad draws: `point_coords` of `scene_forward_clustered.glsl:709`. */
const QUAD_VERTICES = 6;

/** The attribute that holds the vertex each emulated point draws, which `gl_InstanceIndex` reads. */
export const POINT_VERTEX_ATTRIBUTE = 'point_vertex_attrib';

/** The corners of a surface that one draw reads, as a three.js draw group holds them. */
export interface DrawRange {
  readonly start: number;
  readonly count: number;
}

/** A point for each index in `range`, as Vulkan's indexed points: `render_forward_clustered.cpp:603`. */
export function emulatedPointGeometry(
  surface: THREE.BufferGeometry,
  range?: DrawRange
): THREE.InstancedBufferGeometry {
  const vertices = drawnVertices(surface, range);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = vertices.length;
  // three counts a draw's vertices by `position`, which the template does not read.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUAD_VERTICES * 3), 3));
  for (const [name, attribute] of Object.entries(surface.attributes))
    if (name.endsWith('_attrib')) geometry.setAttribute(name, perPoint(attribute, vertices));
  geometry.setAttribute(POINT_VERTEX_ATTRIBUTE, new THREE.InstancedBufferAttribute(vertices, 1));
  geometry.boundingSphere = surface.boundingSphere;
  geometry.boundingBox = surface.boundingBox;
  return geometry;
}

/** The vertex of each corner in `range`, in draw order: every vertex once for a surface with no index. */
function drawnVertices(surface: THREE.BufferGeometry, range: DrawRange | undefined): Float32Array {
  const index = surface.getIndex();
  const cornerCount = index ? index.count : surface.getAttribute('position').count;
  const start = range?.start ?? 0;
  const end = Math.min(range ? start + range.count : cornerCount, cornerCount);
  // A float holds every vertex index below 2^24 exactly.
  const vertices = new Float32Array(Math.max(0, end - start));
  const corners = surface.userData[FIRST_CORNER_LAST] as number | undefined;
  for (let corner = start; corner < end; corner++)
    vertices[corner - start] = index ? index.getX(corners ? godotCorner(corner, corners) : corner) : corner;
  return vertices;
}

/** The loader swaps a triangle's last two corners and `withFirstCornerLast` turns it: Godot's in reverse. */
function godotCorner(corner: number, corners: number): number {
  return corner - (corner % corners) + corners - 1 - (corner % corners);
}

/** `attribute` read once a point: every point shares the one item of a constant attribute. */
function perPoint(attribute: Attribute, vertices: Float32Array): THREE.InstancedBufferAttribute {
  const isConstant = (attribute as THREE.InstancedBufferAttribute).isInstancedBufferAttribute === true;
  const values = storedLanes(attribute, isConstant ? [0] : vertices);
  const perInstance = new THREE.InstancedBufferAttribute(
    values,
    attribute.itemSize,
    attribute.normalized,
    isConstant ? Math.max(1, vertices.length) : 1
  );
  perInstance.gpuType = (attribute as THREE.BufferAttribute).gpuType ?? THREE.FloatType;
  return perInstance;
}
