import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { createDepthPrepass } from '../pipeline/depthPrepass.js';
import { transpileSpatial } from './transpileSpatial.js';

const THRESHOLD = 'scene_data_block.data.opaque_prepass_threshold';

/** The transpiled unshaded shader of `body`, with `modes` after `unshaded`. */
const spatialOf = (body: string, ...modes: string[]) =>
  transpileSpatial(`shader_type spatial;\nrender_mode ${['unshaded', ...modes].join(', ')};\n${body}`);

/** A material the prepass drew, with its state at the draw. */
interface PrepassDrawn {
  readonly material: THREE.Material;
  readonly colorWrite: boolean;
  readonly depthWrite: boolean;
  readonly side: THREE.Side;
}

const CAMERA = new THREE.PerspectiveCamera();
CAMERA.position.set(0, 0, 5);
CAMERA.updateMatrixWorld(true);
CAMERA.updateProjectionMatrix();

/** A renderer that records each draw instead of drawing it. */
function recordingRenderer(drawn: PrepassDrawn[]): THREE.WebGLRenderer {
  const gl = { RENDERER: 0x1f01, getParameter: () => 'Test GPU' };
  return {
    getContext: () => gl,
    renderBufferDirect(
      _camera: THREE.Camera,
      _scene: THREE.Scene,
      _geometry: unknown,
      material: THREE.Material
    ) {
      const { colorWrite, depthWrite, side } = material;
      drawn.push({ material, colorWrite, depthWrite, side });
    },
  } as unknown as THREE.WebGLRenderer;
}

/** What a Forward+ prepass draws in each of `frames` frames of a box with `material` before the camera. */
function prepassFramesOf(material: THREE.Material, frames = 1): PrepassDrawn[][] {
  const prepass = createDepthPrepass();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material), prepass.first, prepass.last);
  scene.updateMatrixWorld(true);
  return Array.from({ length: frames }, () => {
    const drawn: PrepassDrawn[] = [];
    const args = [recordingRenderer(drawn), scene, CAMERA] as unknown as Parameters<
      THREE.Object3D['onBeforeRender']
    >;
    prepass.first.mesh.onBeforeRender(...args);
    prepass.last.mesh.onBeforeRender(...args);
    return drawn;
  });
}

/** What a Forward+ prepass draws in one frame of a box with `material`. */
const prepassDrawsOf = (material: THREE.Material) => prepassFramesOf(material)[0]!;

/** The one draw of a box with `material` in a Forward+ prepass. */
function prepassDrawOf(material: THREE.Material): PrepassDrawn {
  const drawn = prepassDrawsOf(material);
  expect(drawn).toHaveLength(1);
  return drawn[0]!;
}

describe('spatialPrepassDraw', () => {
  it('draws a shared surface with a vertex stage of its own, back faces culled and no colour', () => {
    const { material } = spatialOf('void fragment() {\n\tDEPTH = 0.5;\n}\n');
    const drawn = prepassDrawOf(material);
    const depth = drawn.material as typeof material;
    expect(depth).not.toBe(material);
    expect(depth.vertexNode).not.toBe(material.vertexNode);
    expect(drawn).toMatchObject({ colorWrite: false, depthWrite: true, side: THREE.FrontSide });
  });

  it('builds the depth material once, at its first draw', () => {
    const [first, second] = prepassFramesOf(spatialOf('').material, 2);
    expect(second![0]!.material).toBe(first![0]!.material);
  });

  it('disposes the depth material with the surface material', () => {
    const { material } = spatialOf('');
    let isDisposed = false;
    prepassDrawOf(material).material.addEventListener('dispose', () => (isDisposed = true));
    material.dispose();
    expect(isDisposed).toBe(true);
  });

  it('draws a surface with its own depth draw on the faces its cull mode keeps', () => {
    const { material } = spatialOf('', 'cull_disabled');
    expect(prepassDrawOf(material)).toMatchObject({
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  });

  it('keeps a depth_draw_never or depth_test_disabled surface out, as Godot draws it in the alpha pass', () => {
    expect(prepassDrawsOf(spatialOf('', 'depth_draw_never').material)).toEqual([]);
    expect(prepassDrawsOf(spatialOf('', 'depth_test_disabled').material)).toEqual([]);
  });

  it('keeps an alpha surface with no depth_prepass_alpha out', () => {
    expect(prepassDrawsOf(spatialOf('void fragment() {\n\tALPHA = 0.5;\n}\n').material)).toEqual([]);
  });

  it('draws a depth_prepass_alpha surface writing depth, with the threshold at 0.99', () => {
    const { material, uniforms } = spatialOf('void fragment() {\n\tALPHA = 0.5;\n}\n', 'depth_prepass_alpha');
    expect(prepassDrawOf(material)).toMatchObject({ colorWrite: false, depthWrite: true });
    expect(material.depthWrite).toBe(false);
    expect((uniforms.get(THRESHOLD) as UniformNode<number>).value).toBe(0.99);
  });

  it('draws every gl_compatibility surface with its own depth draw, on the faces its cull mode keeps', () => {
    const { material } = transpileSpatial('shader_type spatial;\nrender_mode unshaded, cull_front;\n', {
      renderingMethod: 'gl_compatibility',
    });
    expect(prepassDrawOf(material).side).toBe(THREE.BackSide);
  });

  it('keeps a gl_compatibility alpha surface with only alpha antialiasing out', () => {
    const { material } = transpileSpatial(
      'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {\n\tALPHA = 0.5;\n\tALPHA_ANTIALIASING_EDGE = 0.2;\n}\n',
      { renderingMethod: 'gl_compatibility' }
    );
    expect(prepassDrawsOf(material)).toEqual([]);
  });

  it('keeps every surface out on Mobile, which draws no depth prepass', () => {
    const { material } = transpileSpatial('shader_type spatial;\nrender_mode unshaded;\n', {
      renderingMethod: 'mobile',
    });
    expect(prepassDrawsOf(material)).toEqual([]);
  });
});

describe("the depth variant's program key", () => {
  it('differs from the colour variant of the same text', () => {
    const { material } = spatialOf('void fragment() {\n\tDEPTH = 0.5;\n}\n');
    expect(prepassDrawOf(material).material.customProgramCacheKey()).not.toBe(
      material.customProgramCacheKey()
    );
  });

  it('is one key for the depth variants of two translations of one text', () => {
    const body = 'void fragment() {\n\tDEPTH = 0.5;\n}\n';
    const [first, second] = [spatialOf(body).material, spatialOf(body).material];
    expect(prepassDrawOf(first).material.customProgramCacheKey()).toBe(
      prepassDrawOf(second).material.customProgramCacheKey()
    );
  });
});
