import * as THREE from 'three';
import { encodedNormalTangent } from '../../godot/rendering/meshNormalTangent.js';

/** The attribute the scene template reads at location 0: the position, which GL widens with w = 1. */
export const VERTEX_ANGLE_ATTRIBUTE = 'vertex_angle_attrib';

/** The attribute at location 1: the normal and the tangent as four 16-bit unsigned normalised lanes. */
export const AXIS_TANGENT_ATTRIBUTE = 'axis_tangent_attrib';

/** `geometry` with an uncompressed Godot surface's attributes (`rendering_server.cpp:425-700`). */
export function withGodotAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('expected a geometry with a position attribute, found none');
  geometry.setAttribute(VERTEX_ANGLE_ATTRIBUTE, position);
  const normal = geometry.getAttribute('normal');
  if (normal)
    geometry.setAttribute(AXIS_TANGENT_ATTRIBUTE, axisTangent(normal, geometry.getAttribute('tangent')));
  return geometry;
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
