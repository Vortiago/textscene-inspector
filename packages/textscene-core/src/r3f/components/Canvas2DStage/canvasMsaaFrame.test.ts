/**
 * The 2D canvas's multisampled frame, driven through a recording renderer: happy-dom has no WebGL,
 * and the renderer is the boundary the frame draws through.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCanvasMsaaFrame } from './canvasMsaaFrame';

type Target = THREE.WebGLRenderTarget | null;

/** A renderer that records each draw and the target bound for it. */
function recordingRenderer(width: number, height: number, bound: Target = null) {
  const draws: { drawn: THREE.Object3D; target: Target }[] = [];
  const gl = {
    getDrawingBufferSize: (out: THREE.Vector2) => out.set(width, height),
    getRenderTarget: () => bound,
    setRenderTarget: (target: Target) => {
      bound = target;
    },
    render: (drawn: THREE.Object3D) => {
      draws.push({ drawn, target: bound });
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, draws, bound: () => bound };
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();

describe('createCanvasMsaaFrame', () => {
  it('draws the world into a target with the samples msaa_2d asks for', () => {
    const { gl, draws } = recordingRenderer(640, 360);
    const frame = createCanvasMsaaFrame(4);

    frame.render(gl, scene, camera);

    expect(draws[0]).toMatchObject({ drawn: scene, target: { samples: 4, width: 640, height: 360 } });
    frame.dispose();
  });

  it('stores sRGB-encoded values in RGBA8, so items blend in the space the drawing buffer blends in', () => {
    const { gl, draws } = recordingRenderer(64, 64);
    const frame = createCanvasMsaaFrame(2);

    frame.render(gl, scene, camera);

    const texture = draws[0]!.target!.texture;
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.internalFormat).toBe('RGBA8');
    frame.dispose();
  });

  it('copies the resolved frame to the drawing buffer after the world draws', () => {
    const { gl, draws } = recordingRenderer(64, 64);
    const frame = createCanvasMsaaFrame(2);

    frame.render(gl, scene, camera);

    expect(draws).toHaveLength(2);
    expect(draws[1]!.drawn).not.toBe(scene);
    expect(draws[1]!.target).toBeNull();
    frame.dispose();
  });

  it('rebinds the target bound before when the world draw throws (error path)', () => {
    const previous = new THREE.WebGLRenderTarget(1, 1);
    const recording = recordingRenderer(64, 64, previous);
    recording.gl.render = () => {
      throw new Error('draw failed');
    };
    const frame = createCanvasMsaaFrame(2);

    expect(() => frame.render(recording.gl, scene, camera)).toThrow('draw failed');
    expect(recording.bound()).toBe(previous);
    frame.dispose();
    previous.dispose();
  });

  it('follows the drawing buffer when the canvas resizes (edge case)', () => {
    const frame = createCanvasMsaaFrame(4);
    frame.render(recordingRenderer(64, 64).gl, scene, camera);
    const resized = recordingRenderer(128, 32);

    frame.render(resized.gl, scene, camera);

    expect(resized.draws[0]!.target).toMatchObject({ width: 128, height: 32 });
    frame.dispose();
  });
});
