/**
 * The 2D canvas's multisampled frame, driven through a recording renderer: happy-dom has no WebGL,
 * and the renderer is the boundary the frame draws through.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCanvasFrame } from './canvasFrame';
import { innermostStep, startFrameProfile } from '../../frameProfile/frameProfile';
import { profiledRendererMembers } from '../../frameProfile/frameProfile.testkit';
import type { RenderStep } from '../../frameProfile/frameStats';

type Target = THREE.WebGLRenderTarget | null;

/** The texture a copy pass samples, read at its draw: the pass holds none after it. */
function sampledFrame(drawn: THREE.Object3D): THREE.Texture | undefined {
  const material = (drawn as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
  return material?.uniforms?.frame?.value;
}

/**
 * A renderer that records each draw, the target bound for it and the frame a copy samples, and each
 * explicit clear with the number of draws that came before it. Its `autoClear` is on, as three's is.
 */
function recordingRenderer(width: number, height: number) {
  const draws: { drawn: THREE.Object3D; target: Target; sampled: THREE.Texture | undefined }[] = [];
  const clears: { target: Target; drawsBefore: number }[] = [];
  let bound: Target = null;
  const gl = {
    autoClear: true,
    getDrawingBufferSize: (out: THREE.Vector2) => out.set(width, height),
    getRenderTarget: () => bound,
    setRenderTarget: (target: Target) => {
      bound = target;
    },
    clear: () => {
      clears.push({ target: bound, drawsBefore: draws.length });
    },
    render: (drawn: THREE.Object3D) => {
      draws.push({ drawn, target: bound, sampled: sampledFrame(drawn) });
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, draws, clears };
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();

/** A frame at `samples`, as `useMultisampledTarget` sets them. */
function multisampledFrame(samples: number): ReturnType<typeof createCanvasFrame> {
  const frame = createCanvasFrame();
  frame.samples = samples;
  return frame;
}

describe('createCanvasFrame', () => {
  it('names its copy to the drawing buffer as the Canvas copy step, so the frame profile shows its cost', () => {
    const { gl, draws } = recordingRenderer(64, 64);
    const stepsOfDraws: (RenderStep | null)[] = [];
    const render = gl.render.bind(gl);
    const profiled = Object.assign(gl, profiledRendererMembers(), {
      render: (drawn: THREE.Object3D, drawnCamera: THREE.Camera) => {
        stepsOfDraws.push(innermostStep(gl));
        render(drawn, drawnCamera);
      },
    });
    const profile = startFrameProfile(
      profiled,
      () => undefined,
      () => 0
    );
    profile.beginFrame(0);
    const frame = multisampledFrame(0);

    frame.render(gl, scene, camera);

    expect(draws).toHaveLength(2);
    expect(stepsOfDraws).toEqual([null, 'Canvas copy']);
    profile.stop();
    frame.dispose();
  });

  // A render clears only while the renderer's autoClear is on, which the tone-map composer turns off.
  it('clears itself before the world draws when the renderer does not clear on render', () => {
    const { gl, draws, clears } = recordingRenderer(64, 64);
    gl.autoClear = false;
    const frame = multisampledFrame(0);

    frame.render(gl, scene, camera);

    expect(clears).toEqual([{ target: frame, drawsBefore: 0 }]);
    expect(draws[0]!.drawn).toBe(scene);
    frame.dispose();
  });

  it('leaves the clear to the render when the renderer clears on render (edge case)', () => {
    const { gl, clears } = recordingRenderer(64, 64);
    const frame = multisampledFrame(0);

    frame.render(gl, scene, camera);

    expect(clears).toEqual([]);
    frame.dispose();
  });

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

  it('keeps no frame in the copy pass when the copy throws (error path)', () => {
    const { gl } = recordingRenderer(64, 64);
    const copied: THREE.Object3D[] = [];
    gl.render = (drawn: THREE.Object3D) => {
      if (drawn === scene) return;
      copied.push(drawn);
      throw new Error('lost context');
    };
    const frame = multisampledFrame(4);

    expect(() => frame.render(gl, scene, camera)).toThrow('lost context');
    expect(sampledFrame(copied[0]!)).toBeNull();
    frame.dispose();
  });

  it('draws at the size of the target bound before it, as a sub-viewport pass binds its own', () => {
    const { gl, draws } = recordingRenderer(640, 360);
    const subViewportTarget = new THREE.WebGLRenderTarget(200, 100);
    gl.setRenderTarget(subViewportTarget);
    const frame = multisampledFrame(0);

    frame.render(gl, scene, camera);

    expect(frame).toMatchObject({ width: 200, height: 100 });
    expect(draws[1]!.target).toBe(subViewportTarget);
    subViewportTarget.dispose();
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
