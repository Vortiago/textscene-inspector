import { describe, expect, it } from 'vitest';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import { printTemplateStage } from './printTemplate.js';
import { withSquareMatrices } from './squareMatrices.js';
import { variantLines } from './variant.js';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };

/** The printed lines of `text` after the rewrite, without the defines Godot adds to every variant. */
function squared(text: string): string {
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  const stage = parseTemplateStage('fragment', preprocess(variantLines(lines, NO_DEFINES)));
  return printTemplateStage(withSquareMatrices(stage))
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}

const inMain = (body: string) => squared(`void main() {\n${body}\n}`);

describe('withSquareMatrices', () => {
  it('holds a mat3x4 struct member as a mat4', () => {
    expect(squared('struct S {\n\tmat3x4 m;\n};')).toContain('\tmat4 m;');
  });

  it('holds a mat3x4 parameter and local as a mat4', () => {
    const printed = squared('void f(in mat3x4 m) {\n\tmat3x4 n = m;\n}');
    expect(printed).toContain('void f(in mat4 m)');
    expect(printed).toContain('mat4 n = m;');
  });

  it('gives a mat3x4 times a vec3 the vec3 with a zero lane, which the zero column takes', () => {
    expect(inMain('mat3x4 m;\nvec3 v;\nvec4 r = m * v;')).toContain('vec4 r = (m * vec4(v, 0.0));');
  });

  it('keeps the rows of a mat4x3 times a vec4, as its zero row gives a fourth lane of zero', () => {
    expect(inMain('mat4x3 m;\nvec4 v;\nvec3 r = m * v;')).toContain('vec3 r = (m * v).xyz;');
  });

  it('gives a vec4 times a mat3x4 the three lanes of its three columns', () => {
    expect(inMain('mat3x4 m;\nvec4 v;\nvec3 r = v * m;')).toContain('vec3 r = (v * m).xyz;');
  });

  it('gives a mat4x3 times a mat3x4 the upper-left mat3 of the product of their squares', () => {
    expect(inMain('mat4x3 a;\nmat3x4 b;\nmat3 r = a * b;')).toContain('mat3 r = mat3((a * b));');
  });

  it('reads a column of a mat4x3 as its three rows', () => {
    expect(inMain('mat4x3 m;\nvec3 c = m[1];')).toContain('vec3 c = (m[1]).xyz;');
  });

  it('builds a mat3x4 of columns with a zero column after them', () => {
    expect(inMain('vec4 a;\nmat3x4 m = mat3x4(a, a, a);')).toContain('mat4 m = mat4(a, a, a, vec4(0.0));');
  });

  it('fills a mat4 of a mat3x4 from the identity where the mat3x4 has no column', () => {
    expect(inMain('mat3x4 t;\nmat4 m = mat4(t);')).toContain('vec4(0.0, 0.0, 0.0, 1.0))');
  });

  it('fills a mat3x4 of a mat3 from the identity where the mat3 has no row', () => {
    expect(inMain('mat3 t;\nmat3x4 m = mat3x4(t);')).toContain('vec4((t[0]).x, (t[0]).y, (t[0]).z, 0.0)');
  });

  it('builds a mat4x3 of columns, each with a zero row', () => {
    expect(inMain('vec3 a;\nmat4x3 m = mat4x3(a, a, a, a);')).toContain(
      'mat4 m = mat4(vec4(a, 0.0), vec4(a, 0.0), vec4(a, 0.0), vec4(a, 0.0));'
    );
  });

  it('refuses a construction it has no square form for, by its types', () => {
    expect(() => inMain('mat3x4 m = mat3x4(1.0);')).toThrow('mat3x4(float)');
  });
});
