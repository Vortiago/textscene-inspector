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

const blockOf = (colors: { canvasModulate: typeof RED }, renderId: number, camera: THREE.Camera) =>
  canvasDataOf(
    gl,
    { renderId, object: new THREE.Object3D(), camera },
    { ...colors, usesLinearColors: false }
  );

const modulationOf = (colors: { canvasModulate: typeof RED }, renderId: number, camera: THREE.Camera) =>
  blockOf(colors, renderId, camera).canvasModulation.toArray();

describe('canvasDataOf', () => {
  it('gives the items of a canvas with the same colours one block in a render', () => {
    const camera = cameraOf();
    const first = blockOf({ canvasModulate: RED }, 1, camera);

    expect(blockOf({ canvasModulate: { ...RED } }, 1, camera)).toBe(first);
  });

  it('gives an item of a canvas with other colours a block of its own in a render', () => {
    const camera = cameraOf();
    modulationOf({ canvasModulate: RED }, 1, camera);

    expect(modulationOf({ canvasModulate: BLUE }, 1, camera)).toEqual([0, 0, 1, 1]);
  });

  it('reuses the blocks of the last render in the next one', () => {
    const camera = cameraOf();
    const red = blockOf({ canvasModulate: RED }, 1, camera);
    blockOf({ canvasModulate: BLUE }, 1, camera);

    expect(blockOf({ canvasModulate: BLUE }, 2, camera)).toBe(red);
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
