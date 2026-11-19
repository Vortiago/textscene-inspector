import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AlphaAntiAliasing } from '../../godot/rendering/materials/alphaAntialiasing.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { alphaToCoverageBlendState, godotBlendState } from '../pipeline/blendState.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import { StencilCompare, StencilFlag } from '../../godot/rendering/materials/stencil.js';
import { godotStencilState } from '../pipeline/stencilState.js';
import { parsedShader } from '../language/parseShader.js';
import { drawsAlphaToCoverage, spatialPipeline, stencilQueueError } from './spatialPipeline.js';
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
      writesDepth: false,
      depthFlags: new Set(),
      stencil: null,
    });
  });

  it('draws alpha to coverage in the alpha pass only', () => {
    const pipelineWith = (fragment: string, modes: string) =>
      spatialPipeline(
        parsedShader(`shader_type spatial;\nrender_mode ${modes};\nvoid fragment() {\n\t${fragment}\n}\n`)
          .tree
      );
    expect(drawsAlphaToCoverage(pipelineWith('ALPHA = 0.5;', 'alpha_to_coverage'))).toBe(true);
    expect(drawsAlphaToCoverage(pipelineWith('ALBEDO = vec3(1.0);', 'alpha_to_coverage'))).toBe(false);
    expect(drawsAlphaToCoverage(pipelineWith('ALPHA = 0.5;', 'blend_add'))).toBe(false);
  });

  it.each([
    ['ALPHA = 0.5;', 'usesAlpha'],
    ['ALPHA_SCISSOR_THRESHOLD = 0.5;', 'usesAlphaClip'],
    ['ALPHA_HASH_SCALE = 0.5;', 'usesAlphaClip'],
    ['ALPHA_ANTIALIASING_EDGE = 0.5;', 'usesAlphaAntialiasing'],
    ['ALPHA_TEXTURE_COORDINATE = UV;', 'usesAlphaAntialiasing'],
    ['DEPTH = 0.5;', 'writesDepth'],
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

  describe('depthFlags', () => {
    const flagsOf = (body: string, head = '') => [
      ...spatialPipeline(parsedShader(`shader_type spatial;\n${head}${body}`).tree).depthFlags,
    ];

    it('sets none for a fragment that writes DEPTH', () => {
      expect(flagsOf('void fragment() {\n\tDEPTH = 0.5;\n}\n')).toEqual([]);
    });

    it.each([
      ['particle_trails', 'uses_particle_trails'],
      ['depth_prepass_alpha', 'uses_depth_prepass_alpha'],
      ['world_vertex_coords', 'uses_world_coordinates'],
      ['wireframe', 'wireframe'],
      ['cull_front', 'cull_not_back'],
      ['cull_disabled', 'cull_not_back'],
    ])('render_mode %s sets %s', (mode, flag) => {
      expect(flagsOf('', `render_mode ${mode};\n`)).toEqual([flag]);
    });

    it.each([
      ['VERTEX = VERTEX;', 'uses_vertex'],
      ['POSITION = vec4(0.0);', 'uses_position'],
      ['MODELVIEW_MATRIX = mat4(1.0);', 'writes_modelview_or_projection'],
      ['PROJECTION_MATRIX = mat4(1.0);', 'writes_modelview_or_projection'],
      ['Z_CLIP_SCALE = 1.0;', 'uses_z_clip_scale'],
      ['POINT_SIZE = 2.0;', 'uses_point_size'],
    ])('a vertex() that runs `%s` sets %s', (statement, flag) => {
      expect(flagsOf(`void vertex() {\n\t${statement}\n}\n`)).toEqual([flag]);
    });

    it('a vertex() that only reads VERTEX sets none', () => {
      expect(flagsOf('void vertex() {\n\tCOLOR = vec4(VERTEX, 1.0);\n}\n')).toEqual([]);
    });

    it('a function that writes VERTEX through an `out` argument sets uses_vertex', () => {
      const body = 'void lift(out vec3 v) { v = vec3(1.0); }\nvoid vertex() {\n\tlift(VERTEX);\n}\n';
      expect(flagsOf(body)).toEqual(['uses_vertex']);
    });

    it.each([
      ['discard;', 'uses_discard'],
      ['ALPHA_SCISSOR_THRESHOLD = 0.5;', 'uses_alpha_clip'],
      ['ALPHA_ANTIALIASING_EDGE = 0.5;', 'uses_alpha_antialiasing'],
    ])('a fragment that runs `%s` sets %s', (statement, flag) => {
      expect(flagsOf(`void fragment() {\n\t${statement}\n}\n`)).toEqual([flag]);
    });

    it('a stencil reference sets stencil_enabled', () => {
      expect(flagsOf('', 'stencil_mode read, compare_equal, 1;\n')).toEqual(['stencil_enabled']);
    });
  });

  it('never sees two modes of one group, which the parser refuses as Godot does', () => {
    expect(() => transpileSpatial('shader_type spatial;\nrender_mode blend_add, blend_sub;\n')).toThrow(
      /blend/
    );
  });
});

describe('a spatial shader’s stencil modes', () => {
  const stencilOf = (head: string, modes = 'unshaded') =>
    spatialPipeline(parsedShader(`shader_type spatial;\nrender_mode ${modes};\n${head}`).tree).stencil;

  it('a stencil_mode with no reference turns the test off, as Godot’s -1 does', () => {
    expect(stencilOf('stencil_mode read, compare_equal;\n')).toBeNull();
  });

  it('a reference with no compare compares ALWAYS', () => {
    expect(stencilOf('stencil_mode write, 4;\n')).toEqual({
      flags: StencilFlag.WRITE,
      compare: StencilCompare.ALWAYS,
      reference: 4,
    });
  });

  it('reads every flag and the compare', () => {
    expect(stencilOf('stencil_mode write, write_depth_fail, compare_greater_or_equal, 255;\n')).toEqual({
      flags: StencilFlag.WRITE | StencilFlag.WRITE_DEPTH_FAIL,
      compare: StencilCompare.GREATER_OR_EQUAL,
      reference: 255,
    });
  });

  it.each([
    ['compare_always', StencilCompare.ALWAYS],
    ['compare_less', StencilCompare.LESS],
    ['compare_equal', StencilCompare.EQUAL],
    ['compare_less_or_equal', StencilCompare.LESS_OR_EQUAL],
    ['compare_greater', StencilCompare.GREATER],
    ['compare_not_equal', StencilCompare.NOT_EQUAL],
    ['compare_greater_or_equal', StencilCompare.GREATER_OR_EQUAL],
  ])('%s is the compare %i', (mode, compare) => {
    expect(stencilOf(`stencil_mode read, ${mode}, 1;\n`)).toMatchObject({ compare });
  });

  it('draws with the stencil state in the colour pass', () => {
    const { material } = transpileSpatial(
      'shader_type spatial;\nrender_mode unshaded, depth_test_disabled;\nstencil_mode read, compare_not_equal, 2;\n'
    );
    expect(material).toMatchObject(
      godotStencilState({ flags: StencilFlag.READ, compare: StencilCompare.NOT_EQUAL, reference: 2 })
    );
  });

  it('draws with no stencil test when the shader names no reference', () => {
    expect(transpileSpatial('shader_type spatial;\nrender_mode unshaded;\n').material.stencilWrite).toBe(
      false
    );
  });

  it('gives Godot’s error for a stencil read in the opaque pass', () => {
    const pipeline = spatialPipeline(
      parsedShader('shader_type spatial;\nstencil_mode read, compare_equal, 1;\n').tree
    );
    expect(stencilQueueError(pipeline, 'res://reader.gdshader')).toBe(
      'Attempting to use a shader (res://reader.gdshader) that reads stencil but is not in the alpha queue. Ensure the material uses alpha blending or has depth_draw disabled or depth_test disabled.'
    );
  });

  it.each([
    ['a read in the alpha pass', 'render_mode depth_test_disabled;\nstencil_mode read, compare_equal, 1;\n'],
    ['a write in the opaque pass', 'stencil_mode write, 1;\n'],
    ['a read with no reference', 'stencil_mode read, compare_equal;\n'],
  ])('gives no error for %s', (_case, head) => {
    expect(
      stencilQueueError(spatialPipeline(parsedShader(`shader_type spatial;\n${head}`).tree), '')
    ).toBeUndefined();
  });

  it('hands Godot’s error to the caller with the material', () => {
    const { printedErrors } = transpileSpatial(
      'shader_type spatial;\nrender_mode unshaded;\nstencil_mode read, compare_equal, 1;\n',
      { file: 'res://reader.gdshader' }
    );
    expect(printedErrors).toEqual([
      expect.stringMatching(/^Attempting to use a shader \(res:\/\/reader.gdshader\) that reads stencil/),
    ]);
  });

  it('names no path for a shader with none, as Godot does', () => {
    const pipeline = spatialPipeline(parsedShader('shader_type spatial;\nstencil_mode read, 1;\n').tree);
    expect(stencilQueueError(pipeline, '')).toMatch(/^Attempting to use a shader {2}that reads stencil/);
  });
});
