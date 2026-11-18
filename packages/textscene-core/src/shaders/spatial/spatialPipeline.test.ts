import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AlphaAntiAliasing } from '../../godot/rendering/materials/alphaAntialiasing.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { alphaToCoverageBlendState, godotBlendState } from '../pipeline/blendState.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import { parsedShader } from '../language/parseShader.js';
import { spatialPipeline } from './spatialPipeline.js';
import { transpileSpatial } from './transpileSpatial.js';

/** The material of an unshaded shader with `modes` after `unshaded`. */
const materialWith = (...modes: string[]) => writing('', ...modes);

/** The material of an unshaded shader whose `fragment()` runs `fragment`, with `modes` after `unshaded`. */
const writing = (fragment: string, ...modes: string[]) =>
  transpileSpatial(
    `shader_type spatial;\nrender_mode ${['unshaded', ...modes].join(', ')};\nvoid fragment() {\n${fragment}\n}\n`
  ).material;

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

  it('a fragment that writes ALPHA draws in the alpha pass, mixed, and writes no depth', () => {
    expect(writing('ALPHA = 0.5;')).toMatchObject({
      ...godotBlendState(BlendMode.MIX),
      transparent: true,
      depthWrite: false,
    });
  });

  it.each(['ALPHA_SCISSOR_THRESHOLD', 'ALPHA_HASH_SCALE'])(
    'ALPHA with %s cuts instead of blending, in the opaque pass',
    (clip) => {
      expect(writing(`ALPHA = 0.5;\n${clip} = 0.5;`)).toMatchObject({ transparent: false, depthWrite: true });
    }
  );

  it('ALPHA_ANTIALIASING_EDGE puts a cut ALPHA back in the alpha pass', () => {
    const fragment = 'ALPHA = 0.5;\nALPHA_SCISSOR_THRESHOLD = 0.5;\nALPHA_ANTIALIASING_EDGE = 0.2;';
    expect(writing(fragment)).toMatchObject({ transparent: true });
  });

  it('alpha_to_coverage draws ALPHA with alpha to coverage and its blend', () => {
    expect(writing('ALPHA = 0.5;', 'alpha_to_coverage')).toMatchObject({
      ...alphaToCoverageBlendState(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE),
      alphaToCoverage: true,
      transparent: true,
    });
  });

  it('alpha_to_coverage_and_one draws with the alpha to one blend', () => {
    expect(writing('ALPHA = 0.5;', 'alpha_to_coverage_and_one')).toMatchObject(
      alphaToCoverageBlendState(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE)
    );
  });

  it('alpha_to_coverage replaces blend_add, so with no ALPHA the shader stays opaque', () => {
    expect(materialWith('blend_add', 'alpha_to_coverage')).toMatchObject({
      transparent: false,
      alphaToCoverage: false,
      blending: THREE.NoBlending,
    });
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
  const fragmentPipeline = (fragment: string, globals = '') =>
    spatialPipeline(
      parsedShader(`shader_type spatial;\n${globals}void fragment() {\n\t${fragment}\n}\n`).tree
    );

  it('reads one mode of each group', () => {
    const modes = 'blend_sub, depth_draw_always, depth_test_inverted, cull_front, alpha_to_coverage_and_one';
    expect(pipelineOf(modes)).toMatchObject({
      blendMode: BlendMode.SUB,
      depthDrawMode: DepthDrawMode.ALWAYS,
      depthTest: 'inverted',
      cullMode: CullMode.FRONT,
      alphaAntialiasing: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE,
    });
  });

  it('keeps Godot’s defaults when the modes name no pipeline group and no function names a built-in', () => {
    expect(pipelineOf('unshaded, skip_vertex_transform')).toEqual({
      blendMode: BlendMode.MIX,
      depthDrawMode: DepthDrawMode.OPAQUE_ONLY,
      depthTest: 'enabled',
      cullMode: CullMode.BACK,
      alphaAntialiasing: AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF,
      usesDepthPrepassAlpha: false,
      usesAlpha: false,
      usesAlphaClip: false,
      usesAlphaAntialiasing: false,
      readsScreen: false,
    });
  });

  it.each([
    ['ALPHA = 0.5;', 'usesAlpha'],
    ['ALPHA_SCISSOR_THRESHOLD = 0.5;', 'usesAlphaClip'],
    ['ALPHA_HASH_SCALE = 0.5;', 'usesAlphaClip'],
    ['ALPHA_ANTIALIASING_EDGE = 0.5;', 'usesAlphaAntialiasing'],
    ['ALPHA_TEXTURE_COORDINATE = UV;', 'usesAlphaAntialiasing'],
  ])('`%s` sets %s, as Godot’s usage flag', (fragment, flag) => {
    expect(fragmentPipeline(fragment)).toMatchObject({ [flag]: true });
  });

  it('a read of ALPHA sets usesAlpha too, as a write does', () => {
    expect(fragmentPipeline('ALBEDO = vec3(ALPHA);').usesAlpha).toBe(true);
  });

  it('a read uniform of the screen texture sets readsScreen', () => {
    const uniform = 'uniform sampler2D screen : hint_screen_texture;\n';
    expect(fragmentPipeline('ALBEDO = texture(screen, SCREEN_UV).rgb;', uniform).readsScreen).toBe(true);
  });

  it('a screen texture uniform no function reads leaves readsScreen false', () => {
    const uniform = 'uniform sampler2D screen : hint_screen_texture;\n';
    expect(fragmentPipeline('ALBEDO = vec3(1.0);', uniform).readsScreen).toBe(false);
  });

  it('never sees two modes of one group, which the parser refuses as Godot does', () => {
    expect(() => transpileSpatial('shader_type spatial;\nrender_mode blend_add, blend_sub;\n')).toThrow(
      /blend/
    );
  });
});
