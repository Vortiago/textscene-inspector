/**
 * Ortho-camera pose for the 2D world canvas, placing canvas pixel p at the stage's
 * screen position pan + p·zoom. R3F's default frustum is one unit per pixel at
 * zoom 1, so camX = (sw/2 − pan.x)/zoom and camY = −(sh/2 − pan.y)/zoom.
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
