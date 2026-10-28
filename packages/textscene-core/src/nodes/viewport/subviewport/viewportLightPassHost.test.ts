/**
 * The host a SubViewport gives its 2D light pass: its offscreen scene and canvas camera, buffers the
 * size of its target, and the clip Godot lights, `Rect2(0, 0, size)` in screen pixels
 * (`renderer_viewport.cpp:390`), seen from the canvas.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createViewportLightPassHost } from './viewportLightPassHost';
import { applyOrthoFrame, orthoFrameForCamera2D, orthoFrameForSize } from './offscreenViewport';
import type { Camera2DTag } from '../../2d/camera2d/cameraView';
import { createViewportCanvasCamera } from '../../../r3f/sceneRenderCamera';
import { Camera2DAnchorMode } from '../../../godot/scene/camera2d';

const SIZE = { x: 200, y: 150 };

function hostOf(size = SIZE) {
  const camera = createViewportCanvasCamera();
  applyOrthoFrame(camera, orthoFrameForSize(size));
  return { camera, host: createViewportLightPassHost(new THREE.Scene(), camera, 'Booth/Viewport', size) };
}

describe('createViewportLightPassHost', () => {
  it("sizes the light buffers to the target, not the renderer's drawing buffer", () => {
    const out = new THREE.Vector2();
    hostOf().host.readBufferSize(out);
    expect(out.toArray()).toEqual([200, 150]);
  });

  it('clips to Rect2(0, 0, size) while nothing frames the canvas, at scale 1', () => {
    expect(hostOf().host.readClip()).toEqual({
      rect: { x: 0, y: -150, w: 200, h: 150 },
      scale: { x: 1, y: 1 },
    });
  });

  it('follows a Camera2D that frames the canvas away from the origin', () => {
    const { camera, host } = hostOf();
    applyOrthoFrame(camera, { left: -100, right: 100, top: 75, bottom: -75, position: [500, -300, 1000] });
    expect(host.readClip().rect).toEqual({ x: 400, y: -375, w: 200, h: 150 });
  });

  it('scales by the zoom: a 2x zoom frames half the canvas and doubles the pixels per unit', () => {
    const { camera, host } = hostOf();
    const zoomed: Camera2DTag = {
      enabled: true,
      zoom: { x: 2, y: 4 },
      offset: { x: 0, y: 0 },
      anchor_mode: Camera2DAnchorMode.DRAG_CENTER,
      limitLeft: -10000000,
      limitTop: -10000000,
      limitRight: 10000000,
      limitBottom: 10000000,
      limitEnabled: false,
    };
    applyOrthoFrame(camera, orthoFrameForCamera2D(zoomed, { x: 100, y: 75 }, SIZE));
    const { rect, scale } = host.readClip();
    expect([rect.w, rect.h]).toEqual([100, 37.5]);
    expect(scale).toEqual({ x: 2, y: 4 });
  });

  it('hands out the same clip while the camera does not move, so a caller compares by identity', () => {
    const { host } = hostOf();
    expect(host.readClip()).toBe(host.readClip());
  });

  it('hands out a new clip once the camera moves', () => {
    const { camera, host } = hostOf();
    const before = host.readClip();
    camera.position.x += 10;
    expect(host.readClip()).not.toBe(before);
  });

  it('follows a resize without a new host, and rescales the clip', () => {
    const { host } = hostOf();
    const before = host.readClip();
    host.resize({ x: 400, y: 300 });
    expect(host.readClip()).not.toBe(before);
    expect(host.readClip().scale).toEqual({ x: 2, y: 2 });
    const out = new THREE.Vector2();
    host.readBufferSize(out);
    expect(out.toArray()).toEqual([400, 300]);
  });

  it('names the canvas it lights by the path of its SubViewport', () => {
    expect(hostOf().host.canvasPath).toBe('Booth/Viewport');
  });

  it('starts with no run to call', () => {
    expect(hostOf().host.run.current).toBeNull();
  });
});
