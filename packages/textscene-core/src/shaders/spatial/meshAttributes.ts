import * as THREE from 'three';
import { encodedNormalTangent } from '../../godot/rendering/meshNormalTangent.js';

/** The attribute the scene template reads at location 0: the position, which GL widens with w = 1. */
const VERTEX_ANGLE_ATTRIBUTE = 'vertex_angle_attrib';

/** The attribute at location 1: the normal and the tangent as four 16-bit unsigned normalised lanes. */
const AXIS_TANGENT_ATTRIBUTE = 'axis_tangent_attrib';

/** The `userData` key that marks turned corners: `clone` and `copy` carry it with the turned index. */
const FIRST_CORNER_LAST = 'godotFirstCornerLast';

/** `geometry` as an uncompressed Godot surface (`rendering_server.cpp:425-700`), first corners as Godot's. */
export function withGodotAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('expected a geometry with a position attribute, found none');
  if (!geometry.userData[FIRST_CORNER_LAST]) withFirstCornerLast(geometry, position.count);
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

/** Each triangle turned to draw its first corner last: `flat` reads Vulkan's first vertex, WebGL's last. */
function withFirstCornerLast(geometry: THREE.BufferGeometry, vertexCount: number): void {
  const index = geometry.getIndex()?.array;
  const cornerCount = index?.length ?? vertexCount;
  if (cornerCount % 3 !== 0)
    throw new Error(`expected a triangle list of a multiple of 3 corners, got ${cornerCount} corners`);
  const turned = vertexCount > 0xffff ? new Uint32Array(cornerCount) : new Uint16Array(cornerCount);
  for (let corner = 0; corner < cornerCount; corner++) {
    const source = corner - (corner % 3) + (((corner % 3) + 1) % 3);
    turned[corner] = index ? index[source]! : source;
  }
  geometry.setIndex(new THREE.BufferAttribute(turned, 1));
  geometry.userData[FIRST_CORNER_LAST] = true;
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
