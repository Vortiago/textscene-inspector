import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { prepassDrawOf } from '../pipeline/depthPrepass.js';
import { transpileSpatial } from './transpileSpatial.js';

const THRESHOLD = 'scene_data_block.data.opaque_prepass_threshold';

/** The transpiled unshaded shader of `body`, with `modes` after `unshaded`. */
const spatialOf = (body: string, ...modes: string[]) =>
  transpileSpatial(`shader_type spatial;\nrender_mode ${['unshaded', ...modes].join(', ')};\n${body}`);

/** The material the prepass draws `material`'s surfaces with. */
const depthOf = (material: THREE.Material) => prepassDrawOf(material)!.material;

describe('spatialPrepassDraw', () => {
  it('draws a shared surface with a vertex stage of its own, back faces culled and no colour', () => {
    const { material } = spatialOf('void fragment() {\n\tDEPTH = 0.5;\n}\n');
    const depth = depthOf(material) as typeof material;
    expect(depth).not.toBe(material);
    expect(depth.vertexNode).not.toBe(material.vertexNode);
    expect(depth).toMatchObject({ colorWrite: false, depthWrite: true, side: THREE.FrontSide });
  });

  it('builds the depth material once, at its first draw', () => {
    const draw = prepassDrawOf(spatialOf('').material)!;
    expect(draw.material).toBe(draw.material);
  });

  it('disposes the depth material with the surface material', () => {
    const { material } = spatialOf('');
    let isDisposed = false;
    depthOf(material).addEventListener('dispose', () => (isDisposed = true));
    material.dispose();
    expect(isDisposed).toBe(true);
  });

  it('draws a surface with its own depth draw on the faces its cull mode keeps', () => {
    const { material } = spatialOf('', 'cull_disabled');
    expect(depthOf(material)).toMatchObject({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
  });

  it('keeps an alpha surface with no depth_prepass_alpha out', () => {
    expect(prepassDrawOf(spatialOf('void fragment() {\n\tALPHA = 0.5;\n}\n').material)).toBeNull();
  });

  it('draws a depth_prepass_alpha surface writing depth, with the threshold at 0.99', () => {
    const { material, uniforms } = spatialOf('void fragment() {\n\tALPHA = 0.5;\n}\n', 'depth_prepass_alpha');
    expect(depthOf(material)).toMatchObject({ colorWrite: false, depthWrite: true });
    expect(material.depthWrite).toBe(false);
    expect((uniforms.get(THRESHOLD) as UniformNode<number>).value).toBe(0.99);
  });

  it('draws a gl_compatibility surface that writes POSITION under cull_front with the shared depth', () => {
    const { material } = transpileSpatial(
      'shader_type spatial;\nrender_mode unshaded, cull_front;\nvoid vertex() {\n\tPOSITION = vec4(VERTEX, 1.0);\n}\n',
      { renderingMethod: 'gl_compatibility' }
    );
    expect(depthOf(material).side).toBe(THREE.FrontSide);
  });

  it('keeps a gl_compatibility alpha surface with only alpha antialiasing out', () => {
    const { material } = transpileSpatial(
      'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {\n\tALPHA = 0.5;\n\tALPHA_ANTIALIASING_EDGE = 0.2;\n}\n',
      { renderingMethod: 'gl_compatibility' }
    );
    expect(prepassDrawOf(material)).toBeNull();
  });

  it('keeps every surface out on Mobile, which draws no depth prepass', () => {
    const { material } = transpileSpatial('shader_type spatial;\nrender_mode unshaded;\n', {
      renderingMethod: 'mobile',
    });
    expect(prepassDrawOf(material)).toBeNull();
  });
});
