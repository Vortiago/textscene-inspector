import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { godotBlendState } from '../pipeline/blendState.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import { parsedShader } from '../language/parseShader.js';
import { spatialPipeline } from './spatialPipeline.js';
import { transpileSpatial } from './transpileSpatial.js';

/** The material of an unshaded shader with `modes` after `unshaded`. */
const materialWith = (...modes: string[]) =>
  transpileSpatial(`shader_type spatial;\nrender_mode ${['unshaded', ...modes].join(', ')};\n`).material;

const ALPHA_PASS_BLEND_MODES = {
  blend_add: BlendMode.ADD,
  blend_sub: BlendMode.SUB,
  blend_mul: BlendMode.MUL,
  blend_premul_alpha: BlendMode.PREMULT_ALPHA,
} as const;

describe('a spatial shader’s draw state', () => {
  it.each([
    ['cull_back', THREE.FrontSide],
    ['cull_front', THREE.BackSide],
    ['cull_disabled', THREE.DoubleSide],
  ])('%s keeps the faces Godot does not cull', (mode, side) => {
    expect(materialWith(mode).side).toBe(side);
  });

  it('culls back faces with no cull mode', () => {
    expect(materialWith().side).toBe(THREE.FrontSide);
  });

  it('draws in the opaque pass with no blend, depth or test mode, writing depth', () => {
    expect(materialWith()).toMatchObject({
      transparent: false,
      blending: THREE.NoBlending,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.LessEqualDepth,
    });
  });

  it.each(Object.entries(ALPHA_PASS_BLEND_MODES))(
    '%s draws in the alpha pass with Godot’s attachment and writes no depth',
    (mode, blendMode) => {
      expect(materialWith(mode)).toMatchObject({
        ...godotBlendState(blendMode),
        transparent: true,
        depthWrite: false,
      });
    }
  );

  it('blend_mix stays in the opaque pass', () => {
    expect(materialWith('blend_mix')).toMatchObject({ transparent: false, blending: THREE.NoBlending });
  });

  it('depth_draw_never draws in the alpha pass and writes no depth', () => {
    expect(materialWith('depth_draw_never')).toMatchObject({ transparent: true, depthWrite: false });
  });

  it('depth_draw_always writes depth in the alpha pass too', () => {
    expect(materialWith('blend_add', 'depth_draw_always')).toMatchObject({
      transparent: true,
      depthWrite: true,
    });
  });

  it('depth_test_disabled draws in the alpha pass with no depth test', () => {
    expect(materialWith('depth_test_disabled')).toMatchObject({ transparent: true, depthTest: false });
  });

  it('depth_test_inverted keeps the fragments behind the depth, in the alpha pass', () => {
    expect(materialWith('depth_test_inverted')).toMatchObject({
      transparent: true,
      depthTest: true,
      depthFunc: THREE.GreaterDepth,
    });
  });
});

describe('spatialPipeline', () => {
  const pipelineOf = (modes: string) =>
    spatialPipeline(parsedShader(`shader_type spatial;\nrender_mode ${modes};\n`).tree);

  it('reads one mode of each group', () => {
    expect(pipelineOf('blend_sub, depth_draw_always, depth_test_inverted, cull_front')).toEqual({
      blendMode: BlendMode.SUB,
      depthDrawMode: DepthDrawMode.ALWAYS,
      depthTest: 'inverted',
      cullMode: CullMode.FRONT,
    });
  });

  it('keeps Godot’s defaults when the modes name no pipeline group', () => {
    expect(pipelineOf('unshaded, skip_vertex_transform')).toEqual({
      blendMode: BlendMode.MIX,
      depthDrawMode: DepthDrawMode.OPAQUE_ONLY,
      depthTest: 'enabled',
      cullMode: CullMode.BACK,
    });
  });

  it('never sees two modes of one group, which the parser refuses as Godot does', () => {
    expect(() => transpileSpatial('shader_type spatial;\nrender_mode blend_add, blend_sub;\n')).toThrow(
      /blend/
    );
  });
});
