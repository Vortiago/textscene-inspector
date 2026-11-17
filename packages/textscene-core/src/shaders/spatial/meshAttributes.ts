import * as THREE from 'three';
import { encodedNormalTangent } from '../../godot/rendering/meshNormalTangent.js';

/** The attribute the scene template reads at location 0: the position, which GL widens with w = 1. */
const VERTEX_ANGLE_ATTRIBUTE = 'vertex_angle_attrib';

/** The attribute at location 1: the normal and the tangent as four 16-bit unsigned normalised lanes. */
const AXIS_TANGENT_ATTRIBUTE = 'axis_tangent_attrib';

/** Written only by `withGodotAttributes`, so a second call turns no triangle again. */
const preparedGeometries = new WeakSet<THREE.BufferGeometry>();

/** `geometry` as an uncompressed Godot surface (`rendering_server.cpp:425-700`), first corners as Godot's. */
export function withGodotAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('expected a geometry with a position attribute, found none');
  if (!preparedGeometries.has(geometry)) withFirstCornerLast(geometry, position.count);
  preparedGeometries.add(geometry);
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
  return geometry;
}

/** Each triangle turned to draw its first corner last: `flat` reads Vulkan's first vertex, WebGL's last. */
function withFirstCornerLast(geometry: THREE.BufferGeometry, vertexCount: number): void {
  const corners = geometry.getIndex()?.array ?? Array.from({ length: vertexCount }, (_, vertex) => vertex);
  if (corners.length % 3 !== 0)
    throw new Error(`expected a triangle list of a multiple of 3 corners, got ${corners.length} corners`);
  const turned = vertexCount > 0xffff ? new Uint32Array(corners.length) : new Uint16Array(corners.length);
  for (let corner = 0; corner < corners.length; corner++)
    turned[corner] = corners[corner - (corner % 3) + (((corner % 3) + 1) % 3)]!;
  geometry.setIndex(new THREE.BufferAttribute(turned, 1));
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
