/**
 * Fakes for tests of live targets: a renderer that records each draw, the copies a target fills, and
 * a target whose renderer answers a readback.
 */
import * as THREE from 'three';
import { fillLiveTarget, publishLiveTarget } from './liveTargets';

/** A renderer that records the target bound for each draw. */
export function recordingRenderer() {
  const drawnInto: (THREE.WebGLRenderTarget | null)[] = [];
  let bound: THREE.WebGLRenderTarget | null = null;
  const gl = {
    autoClear: true,
    getRenderTarget: () => bound,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (target: THREE.WebGLRenderTarget | null) => {
      bound = target;
    },
    render: () => drawnInto.push(bound),
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, drawnInto };
}

/** The textures the pass of `target` fills after a render, in fill order. */
export function copiesFilledFrom(target: THREE.Texture): (THREE.Texture | undefined)[] {
  const { gl, drawnInto } = recordingRenderer();
  fillLiveTarget(target, gl);
  return drawnInto.map((drawn) => drawn?.texture);
}

/**
 * A live target `size` texels square that a renderer publishes, whose bottom row reads `bottom` and
 * every other row `top`. `paint` changes what the next read gives, as a redraw of the target does.
 */
export function readableLiveTarget(size: number, bottom: readonly number[], top: readonly number[]) {
  const target = new THREE.WebGLRenderTarget(size, size);
  let rows = { bottom, top };
  const renderer = {
    readRenderTargetPixels: (
      _target: THREE.WebGLRenderTarget,
      _x: number,
      _y: number,
      width: number,
      height: number,
      buffer: Uint8Array
    ) => {
      for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
          buffer.set(row === 0 ? rows.bottom : rows.top, (row * width + column) * 4);
        }
      }
    },
  } as unknown as THREE.WebGLRenderer;
  const withdraw = publishLiveTarget(target.texture, renderer, false);
  return {
    texture: target.texture,
    paint: (bottomRow: readonly number[], topRow: readonly number[]) => {
      rows = { bottom: bottomRow, top: topRow };
    },
    withdraw,
  };
}
