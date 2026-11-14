import { describe, expect, it } from 'vitest';
import { parse } from '../language/parse.js';
import { tokenize } from '../language/tokenizer.js';
import { compileMaterial, linkTemplateStage } from './link.js';
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

  it("names the user's line when a built-in's text does not link", () => {
    const table = { ...MODE_TABLES.sky!, renames: { ...MODE_TABLES.sky!.renames, COLOR: 'undeclared' } };
    expect(() => skyFragment(DEFAULT_SKY, table)).toThrow(
      expect.objectContaining({ position: expect.objectContaining({ file: 'user.gdshader', line: 4 }) })
    );
  });
});
