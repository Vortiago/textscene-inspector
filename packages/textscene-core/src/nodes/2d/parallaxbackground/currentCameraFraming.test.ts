import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rootViewportDescription } from '../../../r3f/viewportRender/viewportDescription';
import { drawWorld } from '../../../r3f/viewportRender/worldRender';
import { currentCameraFraming } from './currentCameraFraming';

const CAMERA_2D_PATH = 'Root/Camera2D';

function sceneWithCamera2D(): THREE.Scene {
  const scene = new THREE.Scene();
  const camera2D = new THREE.Object3D();
  camera2D.userData.tscnPath = CAMERA_2D_PATH;
  camera2D.userData.camera2d = { enabled: true, zoom: { x: 1, y: 1 }, anchor_mode: 1 };
  scene.add(camera2D);
  return scene;
}

function framingDuringCanvasDraw(camera: THREE.Camera): ReturnType<typeof currentCameraFraming> {
  const render = {
    viewport: rootViewportDescription(null),
    shadowAtlas: null,
    canvasView: { x: 1152, y: 648 },
  };
  let framing: ReturnType<typeof currentCameraFraming> = null;
  drawWorld(render, () => {
    framing = currentCameraFraming(sceneWithCamera2D(), camera, CAMERA_2D_PATH);
  });
  return framing;
}

describe('currentCameraFraming', () => {
  it('frames the orthographic camera that draws a viewport canvas', () => {
    expect(framingDuringCanvasDraw(new THREE.OrthographicCamera(-50, 50, 40, -40))).not.toBeNull();
  });

  it('frames nothing for a perspective camera (edge case)', () => {
    expect(framingDuringCanvasDraw(new THREE.PerspectiveCamera())).toBeNull();
  });
});
