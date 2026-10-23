/**
 * Ortho-camera pose for the 2D world canvas, placing canvas pixel p at the stage's
 * screen position pan + p·zoom. R3F's default frustum is one unit per pixel at
 * zoom 1, so camX = (sw/2 − pan.x)/zoom and camY = −(sh/2 − pan.y)/zoom.
 */

import * as THREE from 'three';
import type { Vector2 } from '../../../godot/math/vector.js';

/** Negates NDC y. */
const FLIP_Y = new THREE.Matrix4().makeScale(1, -1, 1);

/**
 * The 2D world's orthographic camera, whose projection maps the canvas top to NDC y = -1, so GL row 0
 * of the target it draws into is the canvas top, as Godot's framebuffer row 0 is
 * (`renderer_canvas_render_rd.cpp:679-682`). The rasteriser gives a pixel centre on a horizontal
 * edge to the row-0 side, so the rows an edge covers then match Godot's. The flip lives in
 * `updateProjectionMatrix`, which R3F calls on every resize. The canvas items are `DoubleSide`
 * (`canvasItemFacing`), so the reversed winding culls nothing.
 */
export class World2DCamera extends THREE.OrthographicCamera {
  constructor() {
    super(0, 0, 0, 0, 0.1, 4000);
    this.position.z = 1000;
  }

  override updateProjectionMatrix(): void {
    super.updateProjectionMatrix();
    this.projectionMatrix.premultiply(FLIP_Y);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

interface World2DCameraPose {
  x: number;
  y: number;
  zoom: number;
}

export function world2DCameraPose(
  pan: Vector2,
  zoom: number,
  stageWidth: number,
  stageHeight: number
): World2DCameraPose {
  return {
    x: (stageWidth / 2 - pan.x) / zoom,
    y: 0 - (stageHeight / 2 - pan.y) / zoom,
    zoom,
  };
}
