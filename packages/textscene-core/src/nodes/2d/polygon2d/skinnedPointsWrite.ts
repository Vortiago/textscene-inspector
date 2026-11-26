import * as THREE from 'three';
import type { Vector2 } from '../../../godot/math/vector.js';
import { writeGodotPointAsThree } from '../../../r3f/node2dTransform.js';

/** The canvas template's vertex array, which holds Godot's points as they are. */
const TEMPLATE_VERTICES = 'vertex_attrib';

/** Scratch of one point, overwritten by the next. */
const corner = new THREE.Vector3();

/** Writes `points` to the template's vertex array, which the skeleton pass feeds, or to three's positions. */
export function writeSkinnedPoints(geometry: THREE.BufferGeometry, points: readonly Vector2[]): void {
  const vertices = geometry.getAttribute(TEMPLATE_VERTICES) as THREE.BufferAttribute | undefined;
  if (vertices) return writeTemplateVertices(geometry, vertices, points);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const array = position.array as Float32Array;
  for (let i = 0; i < points.length; i++) writeGodotPointAsThree(array, i * 3, points[i]!.x, points[i]!.y);
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
  if (geometry.boundingBox) geometry.computeBoundingBox();
}

/** The template places each vertex itself, so only a canvas group's box, in three's y, follows the skin. */
function writeTemplateVertices(
  geometry: THREE.BufferGeometry,
  vertices: THREE.BufferAttribute,
  points: readonly Vector2[]
): void {
  // Indexed, not `forEach`: no closure per skin per frame.
  const box = geometry.boundingBox?.makeEmpty();
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i]!;
    vertices.setXY(i, x, y);
    box?.expandByPoint(corner.set(x, -y, 0));
  }
  vertices.needsUpdate = true;
}
