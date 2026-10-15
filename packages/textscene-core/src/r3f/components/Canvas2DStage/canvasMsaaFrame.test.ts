/**
 * The 2D canvas's multisampled frame, driven through a recording renderer: happy-dom has no WebGL,
 * and the renderer is the boundary the frame draws through.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CanvasMsaaFrame } from './canvasMsaaFrame';

type Target = THREE.WebGLRenderTarget | null;

/** The texture a copy pass samples, read at its draw: the pass holds none after it. */
function sampledFrame(drawn: THREE.Object3D): THREE.Texture | undefined {
  const material = (drawn as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
  return material?.uniforms?.frame?.value;
}

/** A renderer that records each draw, the target bound for it and the frame a copy samples. */
function recordingRenderer(width: number, height: number) {
  const draws: { drawn: THREE.Object3D; target: Target; sampled: THREE.Texture | undefined }[] = [];
  let bound: Target = null;
  const gl = {
    getDrawingBufferSize: (out: THREE.Vector2) => out.set(width, height),
    getRenderTarget: () => bound,
    setRenderTarget: (target: Target) => {
      bound = target;
    },
    render: (drawn: THREE.Object3D) => {
      draws.push({ drawn, target: bound, sampled: sampledFrame(drawn) });
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, draws };
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();

/** A frame at `samples`, as `useMultisampledTarget` sets them. */
function multisampledFrame(samples: number): CanvasMsaaFrame {
  const frame = new CanvasMsaaFrame();
  frame.samples = samples;
  return frame;
}

describe('CanvasMsaaFrame', () => {
  it('draws the world into itself at the drawing buffer size', () => {
    const { gl, draws } = recordingRenderer(640, 360);
    const frame = multisampledFrame(4);

    frame.render(gl, scene, camera);

    expect(draws[0]!.drawn).toBe(scene);
    expect(draws[0]!.target).toBe(frame);
    expect(frame).toMatchObject({ samples: 4, width: 640, height: 360 });
    frame.dispose();
  });

  it('stores sRGB-encoded values in RGBA8, so items blend in the space the drawing buffer blends in', () => {
    const frame = multisampledFrame(2);

    const texture = frame.texture;
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.internalFormat).toBe('RGBA8');
    frame.dispose();
  });

  it('copies the resolved frame to the drawing buffer after the world draws', () => {
    const { gl, draws } = recordingRenderer(64, 64);
    const frame = multisampledFrame(2);

    frame.render(gl, scene, camera);

    expect(draws).toHaveLength(2);
    expect(draws[1]!.drawn).not.toBe(scene);
    expect(draws[1]!.target).toBeNull();
    frame.dispose();
  });

  it('copies its own texture when another frame on the renderer copied before it (edge case)', () => {
    const { gl, draws } = recordingRenderer(64, 64);
    const frame = multisampledFrame(4);
    const other = multisampledFrame(4);
    other.render(gl, scene, camera);

    frame.render(gl, scene, camera);

    expect(draws[3]!.sampled).toBe(frame.texture);
    other.dispose();
    frame.dispose();
  });

  it('keeps no frame in the copy pass once the copy has drawn (edge case)', () => {
    const { gl, draws } = recordingRenderer(64, 64);
    const frame = multisampledFrame(2);

    frame.render(gl, scene, camera);

    expect(sampledFrame(draws[1]!.drawn)).toBeNull();
    frame.dispose();
  });

  it('rebinds the target bound before when the world draw throws (error path)', () => {
    const { gl } = recordingRenderer(64, 64);
    const before = new THREE.WebGLRenderTarget(64, 64);
    gl.setRenderTarget(before);
    gl.render = () => {
      throw new Error('lost context');
    };
    const frame = multisampledFrame(4);

    expect(() => frame.render(gl, scene, camera)).toThrow('lost context');
    expect(gl.getRenderTarget()).toBe(before);
    frame.dispose();
  });

  it('follows the drawing buffer when the canvas resizes (edge case)', () => {
    const frame = multisampledFrame(4);
    frame.render(recordingRenderer(64, 64).gl, scene, camera);
    const resized = recordingRenderer(128, 32);

    frame.render(resized.gl, scene, camera);

    expect(resized.draws[0]!.target).toMatchObject({ width: 128, height: 32 });
    frame.dispose();
  });
});
