import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { World2DCamera, world2DCameraPose } from '../components/Canvas2DStage/world2DCamera';
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

  it("measures the screen over the whole target when the camera shows no viewport of Godot's", () => {
    const block = blockOf({ canvasModulate: RED }, 1, cameraOf());

    expect(block.screenPixelSize.toArray()).toEqual([1 / 64, 1 / 32]);
    expect(block.viewportInTarget.toArray()).toEqual([0, 0, 1, 1]);
  });

  it("measures the screen over Godot's viewport where the camera shows it", () => {
    const block = blockOf({ canvasModulate: RED }, 1, stageCamera({ x: 10, y: 20 }, 2));

    expect(block.screenPixelSize.toArray()).toEqual([1 / 1152, 1 / 648]);
    expect(block.viewportInTarget.toArray()).toEqual([10, 20, 0.5, 0.5]);
  });
});

/** The 2D stage's camera over a 64x32 target, with a 1152x648 viewport at `pan`. */
function stageCamera(pan: { x: number; y: number }, zoom: number): World2DCamera {
  const camera = new World2DCamera();
  Object.assign(camera, { left: -32, right: 32, top: 16, bottom: -16 });
  const pose = world2DCameraPose(pan, zoom, 64, 32);
  camera.position.set(pose.x, pose.y, 1000);
  camera.zoom = pose.zoom;
  camera.viewportSize = { x: 1152, y: 648 };
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
