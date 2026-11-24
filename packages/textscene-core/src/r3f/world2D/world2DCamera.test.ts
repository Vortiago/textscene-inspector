/**
 * The camera places canvas pixel p at the overlay frame's screen = pan + p·zoom.
 * Under R3F's ortho frustum, screen.x = sw/2 + (wx − camX)·zoom and
 * screen.y = sh/2 − (wy − camY)·zoom, with world = (p.x, −p.y).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { World2DCamera, world2DCameraPose } from './world2DCamera';

function screenOf(
  p: { x: number; y: number },
  cam: { x: number; y: number; zoom: number },
  sw: number,
  sh: number
) {
  return {
    x: sw / 2 + (p.x - cam.x) * cam.zoom,
    y: sh / 2 - (-p.y - cam.y) * cam.zoom,
  };
}

describe('world2DCameraPose', () => {
  it('aligns the world origin with the overlay frame origin (screen = pan)', () => {
    const cam = world2DCameraPose({ x: 120, y: 80 }, 1.5, 900, 600);
    expect(cam.zoom).toBe(1.5);
    const s = screenOf({ x: 0, y: 0 }, cam, 900, 600);
    expect(s.x).toBeCloseTo(120, 6);
    expect(s.y).toBeCloseTo(80, 6);
  });

  it('aligns an arbitrary canvas pixel under zoom and pan', () => {
    const cam = world2DCameraPose({ x: -50, y: 200 }, 0.5, 1280, 720);
    const s = screenOf({ x: 1152, y: 648 }, cam, 1280, 720);
    expect(s.x).toBeCloseTo(-50 + 1152 * 0.5, 6);
    expect(s.y).toBeCloseTo(200 + 648 * 0.5, 6);
  });
});

/** The NDC of canvas pixel `p` under `camera` placed by `world2DCameraPose` for a `sw` x `sh` stage. */
function ndcOf(camera: World2DCamera, p: { x: number; y: number }, sw: number, sh: number) {
  const pose = world2DCameraPose({ x: 0, y: 0 }, 1, sw, sh);
  camera.position.set(pose.x, pose.y, 1000);
  camera.updateMatrixWorld();
  return new THREE.Vector3(p.x, -p.y, 0).project(camera);
}

/** What R3F writes to an orthographic camera when the canvas resizes (`updateCamera` in events). */
function resizeLikeR3F(camera: World2DCamera, sw: number, sh: number) {
  camera.left = sw / -2;
  camera.right = sw / 2;
  camera.top = sh / 2;
  camera.bottom = sh / -2;
  camera.updateProjectionMatrix();
}

describe('World2DCamera', () => {
  // renderer_canvas_render_rd.cpp:679-682: Godot maps canvas y straight to framebuffer y, so GL row
  // 0 is the canvas top.
  it('maps the canvas top to NDC y = -1 and the canvas bottom to +1', () => {
    const camera = new World2DCamera();
    resizeLikeR3F(camera, 1152, 648);

    expect(ndcOf(camera, { x: 0, y: 0 }, 1152, 648).y).toBeCloseTo(-1, 6);
    expect(ndcOf(camera, { x: 0, y: 648 }, 1152, 648).y).toBeCloseTo(1, 6);
  });

  it('keeps canvas x left to right (edge case)', () => {
    const camera = new World2DCamera();
    resizeLikeR3F(camera, 1152, 648);

    expect(ndcOf(camera, { x: 0, y: 0 }, 1152, 648).x).toBeCloseTo(-1, 6);
    expect(ndcOf(camera, { x: 1152, y: 0 }, 1152, 648).x).toBeCloseTo(1, 6);
  });

  it('keeps the flip after the stage resizes (edge case)', () => {
    const camera = new World2DCamera();
    resizeLikeR3F(camera, 1152, 648);
    resizeLikeR3F(camera, 800, 301);

    expect(ndcOf(camera, { x: 0, y: 0 }, 800, 301).y).toBeCloseTo(-1, 6);
  });

  it('keeps projectionMatrixInverse the inverse of the flipped projection (edge case)', () => {
    const camera = new World2DCamera();
    resizeLikeR3F(camera, 1152, 648);
    camera.position.set(576, -324, 1000);
    camera.updateMatrixWorld();

    const round = new THREE.Vector3(10, -20, 0).project(camera).unproject(camera);
    expect(round.x).toBeCloseTo(10, 6);
    expect(round.y).toBeCloseTo(-20, 6);
  });
});
