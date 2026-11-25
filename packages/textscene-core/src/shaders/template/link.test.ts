import { describe, expect, it } from 'vitest';
import { parse } from '../language/parse.js';
import { tokenize } from '../language/tokenizer.js';
import { compileMaterial, linkTemplateStage, templateVariant } from './link.js';
import { MODE_TABLES } from './modeTables.generated.js';
import { printTemplateStage } from './printTemplate.js';
import { DEFAULT_SKY } from '../sky/defaultSky.testkit';

const materialOf = (source: string) => parse(tokenize(source, 'user.gdshader'));

const skyFragment = (source: string, table = MODE_TABLES.sky!) =>
  printTemplateStage(
    linkTemplateStage('environment/sky.glsl', 'fragment', '', compileMaterial(materialOf(source), table))
  );

describe('compileMaterial', () => {
  it('fills the code section of each stage function', () => {
    expect([...compileMaterial(materialOf(DEFAULT_SKY), MODE_TABLES.sky!).code.keys()]).toEqual(['SKY']);
  });

  it('adds the usage define of each built-in the material reads', () => {
    const source = 'shader_type sky;\nvoid sky() {\n\tCOLOR = HALF_RES_COLOR.rgb;\n}\n';
    expect(compileMaterial(materialOf(source), MODE_TABLES.sky!).custom).toEqual([
      '\n#define USES_HALF_RES_COLOR\n',
    ]);
  });

  it('adds the define of each render mode before the usage defines, as Godot does', () => {
    const source =
      'shader_type sky;\nrender_mode use_debanding, disable_fog;\nvoid sky() {\n\tCOLOR = HALF_RES_COLOR.rgb;\n}\n';
    expect(compileMaterial(materialOf(source), MODE_TABLES.sky!).custom).toEqual([
      '#define USE_DEBANDING\n',
      '#define DISABLE_FOG\n',
      '\n#define USES_HALF_RES_COLOR\n',
    ]);
  });

  it('adds the define of a repeated render mode once, and the same text of another mode again', () => {
    const table = { ...MODE_TABLES.sky!, render_mode_defines: { a: '#define A\n', b: '#define A\n' } };
    const shader = { ...materialOf(DEFAULT_SKY), renderModes: [{ name: 'a' }, { name: 'a' }, { name: 'b' }] };
    expect(compileMaterial(shader as never, table).custom).toEqual(['#define A\n', '#define A\n']);
  });

  it("adds the define a usage define names with '@', as Godot's compiler does", () => {
    const usage = {
      HALF_RES_COLOR: '@QUARTER_RES_COLOR',
      QUARTER_RES_COLOR: '#define USES_QUARTER_RES_COLOR\n',
    };
    const table = { ...MODE_TABLES.sky!, usage_defines: usage };
    const source = 'shader_type sky;\nvoid sky() {\n\tCOLOR = HALF_RES_COLOR.rgb;\n}\n';
    expect(compileMaterial(materialOf(source), table).custom).toEqual(['#define USES_QUARTER_RES_COLOR\n']);
  });
});

describe('compileMaterial uniforms', () => {
  const hasUniforms = (uniforms: string) =>
    compileMaterial(materialOf(`shader_type canvas_item;\n${uniforms}\n`), MODE_TABLES.canvas_item!)
      .hasUniforms;

  it('makes the MaterialUniforms block for a uniform of the material and a global one', () => {
    expect([hasUniforms('uniform float amount;'), hasUniforms('global uniform vec4 tint;')]).toEqual([
      true,
      true,
    ]);
  });

  it('makes no block for a sampler or an instance uniform, which Godot binds apart', () => {
    expect([
      hasUniforms('uniform sampler2D noise;'),
      hasUniforms('instance uniform float amount;'),
      hasUniforms(''),
    ]).toEqual([false, false, false]);
  });

  it('defines MATERIAL_UNIFORMS_USED in the stage of a material with a uniform', () => {
    const material = compileMaterial(
      materialOf('shader_type canvas_item;\nuniform float amount;\n'),
      MODE_TABLES.canvas_item!
    );
    const lines = templateVariant('canvas.glsl', 'fragment', '', material);
    expect(lines.some((line) => 'text' in line && line.text === '#define MATERIAL_UNIFORMS_USED')).toBe(true);
  });
});

describe('compileMaterial varyings', () => {
  const varyingsOf = (declarations: string, vertex: string, fragment = '') => {
    const source = `shader_type spatial;\n${declarations}\nvoid vertex() {\n${vertex}\n}\nvoid fragment() {\n${fragment}\n}\n`;
    const { vertex: vertexGlobals, fragment: fragmentGlobals } = compileMaterial(
      materialOf(source),
      MODE_TABLES.spatial!
    ).varyings;
    const text = (globals: typeof vertexGlobals) =>
      globals.map(
        (global) => `${global.qualifiers.words.join(' ')} ${global.type} ${global.declarators[0]!.name}`
      );
    return { vertex: text(vertexGlobals), fragment: text(fragmentGlobals) };
  };

  it('declares a varying the vertex stage writes as an out of the vertex stage and an in of the fragment stage', () => {
    expect(varyingsOf('varying vec3 tint;', '\ttint = VERTEX;')).toEqual({
      vertex: ['out vec3 m_tint'],
      fragment: ['in vec3 m_tint'],
    });
  });

  it('keeps flat on both stages, and writes nothing for smooth', () => {
    expect(
      varyingsOf('varying flat int band;\nvarying smooth float fade;', '\tband = 1;\n\tfade = 0.5;')
    ).toEqual({
      vertex: ['flat out int m_band', 'out float m_fade'],
      fragment: ['flat in int m_band', 'in float m_fade'],
    });
  });

  it('declares a varying the fragment stage writes as a global of the fragment stage only', () => {
    expect(varyingsOf('varying float fade;', '', '\tfade = 0.5;')).toEqual({
      vertex: [],
      fragment: [' float m_fade'],
    });
  });

  it('declares no boolean varying that no stage writes, as Godot does', () => {
    expect(varyingsOf('varying bool seen;', '')).toEqual({ vertex: [], fragment: [] });
  });
});

describe('linkTemplateStage', () => {
  it("puts the material's stage function in the template's code slot", () => {
    expect(skyFragment(DEFAULT_SKY)).toMatch(/\{\n\t*\{\n\t*\(color = vec3\(0\.0[^\n]*\);\n\t*\}\n\t*\}/);
  });

  it("reads a built-in as its GLSL text, in the template's scope", () => {
    expect(skyFragment('shader_type sky;\nvoid sky() {\n\tCOLOR = vec3(TIME);\n}\n')).toContain(
      '(color = vec3(params.time));'
    );
  });

  it("gives each name of the material Godot's id", () => {
    const source =
      'shader_type sky;\nfloat f(float x) { return x; }\nvoid sky() {\n\tfloat a = f(1.0);\n\tCOLOR = vec3(a);\n}\n';
    const printed = skyFragment(source);
    expect(printed).toContain('float m_f(in float m_x)');
    expect(printed).toContain('float m_a = m_f(1.0);');
  });

  it("gives a material function that shares a template function's name its own id", () => {
    const source =
      'shader_type sky;\nfloat acos_approx(float x) { return x; }\nvoid sky() {\n\tCOLOR = vec3(acos_approx(1.0));\n}\n';
    const stage = linkTemplateStage(
      'environment/sky.glsl',
      'fragment',
      '',
      compileMaterial(materialOf(source), MODE_TABLES.sky!)
    );
    const names = stage.declarations.flatMap((declaration) =>
      declaration.kind === 'function' && declaration.rname.endsWith('acos_approx') ? [declaration.name] : []
    );
    expect(names).toEqual(['m_acos_approx', 'acos_approx']);
  });

  it("reads a built-in whose text is a template macro as the macro's value", () => {
    const source = 'shader_type sky;\nvoid sky() {\n\tCOLOR = vec3(float(AT_CUBEMAP_PASS));\n}\n';
    expect(skyFragment(source)).toContain('color = vec3(float(false))');
  });

  it('reads a built-in in a function of the material that no stage calls itself', () => {
    const source = 'shader_type sky;\nfloat t() { return TIME; }\nvoid sky() {\n\tCOLOR = vec3(t());\n}\n';
    expect(skyFragment(source)).toContain('return params.time;');
  });

  it("names the user's line when a built-in's text does not link", () => {
    const table = { ...MODE_TABLES.sky!, renames: { ...MODE_TABLES.sky!.renames, COLOR: 'undeclared' } };
    expect(() => skyFragment(DEFAULT_SKY, table)).toThrow(
      expect.objectContaining({ position: expect.objectContaining({ file: 'user.gdshader', line: 4 }) })
    );
  });
});
