/**
 * The view a parallax node scrolls against: the current Camera2D of the viewport a render pass
 * draws. Godot reaches it through the `"__cameras_" + viewport id` group.
 */

import * as THREE from 'three';
import { Camera2DAnchorMode } from '../../../godot/scene/camera2d';
import { renderUnderWay } from '../../../r3f/viewportRender/worldRender';
import { camera2DAtPath } from '../../../r3f/viewportRender/viewportFraming';
import type { Camera2DTag } from '../../../r3f/viewportRender/camera2DView';
import { parallaxViewFraming, type ParallaxViewFraming } from './parallaxScroll';

/** Null on the main 2D stage, which frames no camera, and in a viewport with no current Camera2D. */
export function currentCameraFraming(
  scene: THREE.Scene,
  camera: THREE.Camera,
  cameraPath: string | null
): ParallaxViewFraming | null {
  if (!renderUnderWay()?.hasCanvasTransform || !(camera instanceof THREE.OrthographicCamera)) return null;
  const { left, right, top, bottom, position, zoom } = camera;
  const tag = camera2DAtPath(scene, cameraPath)?.userData.camera2d as Camera2DTag | undefined;
  if (!tag) return null;
  return parallaxViewFraming(
    { left, right, top, bottom, x: position.x, y: position.y, zoom },
    tag.zoom.x || 1,
    tag.anchor_mode !== Camera2DAnchorMode.FIXED_TOP_LEFT
  );
}
