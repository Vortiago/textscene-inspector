/**
 * A mesh's geometry as the 2D canvas draws it. Godot's canvas reads each vertex's x and y, the
 * UV and the colour, and drops z, the normal and the tangent
 * (`servers/rendering/renderer_rd/shaders/canvas.glsl:8,172-181`).
 */

import * as THREE from 'three';
import { copyDrawnPrimitive } from '../../resources/meshes/godotSurface';

/** The attributes the canvas reads beside the position. */
const CANVAS_ATTRIBUTES = ['uv', 'color'] as const;

/**
 * `geometry` with the position at (x, -y, 0), since Godot's canvas runs +y down and the world runs
 * +y up. The UV, the colour, the index and a points or lines mark carry over. The caller disposes
 * the result, which owns its buffers.
 *
 * @canonical A mesh's geometry as the 2D canvas draws it
 */
export function canvasMeshGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const source = geometry.getAttribute('position');
  const positions = new Float32Array(source.count * 3);
  for (let i = 0; i < source.count; i++) {
    positions[i * 3] = source.getX(i);
    positions[i * 3 + 1] = -source.getY(i);
  }

  const canvas = new THREE.BufferGeometry();
  canvas.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  for (const name of CANVAS_ATTRIBUTES) {
    const attribute = geometry.getAttribute(name);
    if (attribute) canvas.setAttribute(name, attribute.clone());
  }
  const index = geometry.getIndex();
  if (index) canvas.setIndex(index.clone());
  copyDrawnPrimitive(geometry, canvas);
  return canvas;
}
