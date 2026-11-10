/**
 * The view a parallax node scrolls against: the current Camera2D of the viewport a render pass
 * draws. Godot reaches it through the `"__cameras_" + viewport id` group.
 */

import type * as THREE from 'three';
import { Camera2DAnchorMode } from '../../../godot/scene/camera2d';
import { isViewportPass } from '../../../r3f/sceneRenderCamera';
import { selectViewportCamera2D } from '../../viewport/subviewport/offscreenViewport';
import type { Camera2DTag } from '../camera2d/cameraView';
import { parallaxViewFraming, type ParallaxViewFraming } from './parallaxScroll';

/**
 * Null on the main 2D stage, which frames no camera, and in a viewport with no current Camera2D.
 * An offscreen pass draws the viewport's own scene, so `scene` holds that viewport's cameras.
 */
export function currentCameraFraming(scene: THREE.Scene, camera: THREE.Camera): ParallaxViewFraming | null {
  if (!isViewportPass(camera)) return null;
  const tag = selectViewportCamera2D(scene)?.userData.camera2d as Camera2DTag | undefined;
  if (!tag) return null;
  return parallaxViewFraming(
    {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      x: camera.position.x,
      y: camera.position.y,
      zoom: camera.zoom,
    },
    tag.zoom.x || 1,
    tag.anchor_mode !== Camera2DAnchorMode.FIXED_TOP_LEFT
  );
}
