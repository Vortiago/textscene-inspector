/**
 * Ortho-camera pose math for the 2D world canvas (pure module). The stage
 * CSS-transforms the overlay frame by translate(pan)·scale(zoom); the world
 * canvas must place Godot canvas pixel p at the identical screen position
 * (pan + p·zoom). Under R3F's default orthographic frustum (1 world unit =
 * 1 screen pixel at zoom 1, centered on the camera), that pins the camera:
 *   camX = (sw/2 − pan.x)/zoom,  camY = −(sh/2 − pan.y)/zoom.
 */

export interface World2DCameraPose {
  x: number;
  y: number;
  zoom: number;
}

export function world2DCameraPose(
  pan: { x: number; y: number },
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
