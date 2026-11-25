import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { canvasDataOf } from './canvasFrameBlocks';

const gl = {
  getRenderTarget: () => null,
  getDrawingBufferSize: (size: THREE.Vector2) => size.set(64, 32),
} as unknown as THREE.WebGLRenderer;

const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };

function cameraOf(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-32, 32, 16, -16);
  camera.updateMatrixWorld();
  return camera;
}

const modulationOf = (colors: { canvasModulate: typeof RED }, renderId: number, camera: THREE.Camera) =>
  canvasDataOf(
    gl,
    { renderId, object: new THREE.Object3D(), camera },
    { ...colors, usesLinearColors: false }
  ).canvasModulation.toArray();

describe('canvasDataOf', () => {
  it('writes the block of a canvas once per render, from its first item', () => {
    const camera = cameraOf();
    modulationOf({ canvasModulate: RED }, 1, camera);

    expect(modulationOf({ canvasModulate: BLUE }, 1, camera)).toEqual([1, 0, 0, 1]);
  });

  it('writes the block again for the next render', () => {
    const camera = cameraOf();
    modulationOf({ canvasModulate: RED }, 1, camera);

    expect(modulationOf({ canvasModulate: BLUE }, 2, camera)).toEqual([0, 0, 1, 1]);
  });

  it('keeps a block for each canvas', () => {
    modulationOf({ canvasModulate: RED }, 1, cameraOf());

    expect(modulationOf({ canvasModulate: BLUE }, 1, cameraOf())).toEqual([0, 0, 1, 1]);
  });
});
