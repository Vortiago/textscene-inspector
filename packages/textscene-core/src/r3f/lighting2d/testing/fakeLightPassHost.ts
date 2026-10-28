/**
 * A `LightPassHost` for a test: a bare scene and camera, buffers of a fixed size, and a clip a test
 * may replace. The test runs the pass by hand through `run.current`.
 */

import * as THREE from 'three';
import type { CanvasClip, LightPassHost } from '../lightPassHost';

interface FakeLightPassHost extends LightPassHost {
  readonly camera: THREE.OrthographicCamera;
  /** What `readClip` hands out. A test assigns a new object to move the canvas. */
  clip: CanvasClip;
}

export function fakeLightPassHost(width: number, height: number): FakeLightPassHost {
  const host: FakeLightPassHost = {
    canvasPath: null,
    scene: new THREE.Scene(),
    camera: new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100),
    run: { current: null },
    readBufferSize: (out) => out.set(width, height),
    clip: { rect: { x: 0, y: -height, w: width, h: height }, scale: { x: 1, y: 1 } },
    readClip: () => host.clip,
  };
  return host;
}
