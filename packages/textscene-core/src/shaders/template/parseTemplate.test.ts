import { describe, expect, it } from 'vitest';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import { printTemplateStage } from './printTemplate.js';
import type { StageName } from './stages.js';
import type { TemplateStageNode } from './templateTree.js';
import { variantLines } from './variant.js';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };

function parsed(text: string, stage: StageName = 'compute'): TemplateStageNode {
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  return parseTemplateStage(stage, preprocess(variantLines(lines, NO_DEFINES)));
}

/** The printed text of `text` without the defines Godot adds to every variant. */
const printed = (text: string, stage?: StageName) =>
  printTemplateStage(parsed(text, stage))
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');

const inFunction = (body: string) => printed(`void main() {\n${body}\n}`);

describe('parseTemplateStage', () => {
  it('reads an interface block with its layout, members and instance', () => {
    const text =
      'layout(set = 0, binding = 1, std140) uniform Params {\n\tvec4 color;\n\tfloat data[4];\n} params;';
    expect(printed(text)).toBe(
      'layout(set = 0, binding = 1, std140) uniform Params {\n\tvec4 color;\n\tfloat data[4];\n} params;'
    );
  });

  it('fails on a token the grammar has no place for', () => {
    expect(() => parsed('float a b;')).toThrow("'b' : expected ','");
  });

  it('names the line of the template a failure is on', () => {
    expect(() => parsed('void main() {\n\tfloat a = undeclared;\n}')).toThrow(
      expect.objectContaining({ position: expect.objectContaining({ file: 't.glsl', line: 2 }) })
    );
  });

  it('writes an implicit conversion as its constructor', () => {
    expect(inFunction('float f = 1;')).toContain('float f = float(1);');
  });

  it('reads an array of arrays with the outer size first', () => {
    expect(inFunction('float a[2][3];\nfloat b = a[1][2];')).toContain('float[3] a[2];');
  });

  it('reads the sizes written after the type as the sizes of the name', () => {
    expect(inFunction('vec4[2][3] a;')).toContain('vec4[3] a[2];');
  });

  it('reads an initialiser list of an array of vectors', () => {
    expect(printed('const vec2 v[2] = { vec2(1.0), { 2.0, 3.0 } };')).toContain(
      'const vec2 v[2] = vec2[2](vec2(1.0), vec2(2.0, 3.0));'
    );
  });

  it('refuses an initialiser list of the wrong length', () => {
    expect(() => parsed('const vec2 v = { 1.0 };')).toThrow('expected 2 initialisers for vec2, found 1');
  });

  it('reads an invariant redeclaration of a built-in', () => {
    expect(printed('invariant gl_Position;', 'vertex')).toBe('invariant gl_Position;');
  });

  it('refuses a reserved word as a name, as glslang does', () => {
    expect(() => parsed('float output;')).toThrow("'output' : Reserved word.");
  });

  it('reads a swizzle of a scalar as the vector of its copies', () => {
    expect(inFunction('float s = 1.0;\nvec4 v = s.xxxx;')).toContain('vec4 v = vec4(s);');
  });

  it('reads a one-letter swizzle of a scalar as the scalar', () => {
    expect(inFunction('float s = 1.0;\ns.r = 2.0;')).not.toContain('.r');
  });

  it("reads a vector's length() as its constant component count", () => {
    expect(inFunction('vec3 n;\nint l = n.length();')).toContain('int l = 3;');
  });

  it('resolves mix with a boolean vector to its GLSL overload', () => {
    expect(inFunction('ivec2 m = mix(ivec2(0), ivec2(1), bvec2(true));')).toContain(
      'mix(ivec2(0), ivec2(1), bvec2(true))'
    );
  });

  it('resolves a built-in of 16-bit floats to its 16-bit overload, with no conversion', () => {
    expect(inFunction('f16vec3 a;\nf16vec3 c = cross(a, a);')).toContain('f16vec3 c = cross(a, a);');
  });

  it('gives a GLSL bitCount of an unsigned value a signed count', () => {
    expect(inFunction('uint u = 1u;\nuint c = bitCount(u);')).toContain('uint c = uint(bitCount(u));');
  });

  it('keeps the slot of a stage function where a material puts its code', () => {
    const [main] = parsed('void main() {\n#CODE : SKY\n}').declarations;
    expect(main?.kind === 'function' && main.body.statements).toEqual([
      { kind: 'slot', name: 'SKY', position: { file: 't.glsl', line: 2, column: 1 } },
    ]);
  });

  it('gives the same tree for the same text', () => {
    const text = 'layout(local_size_x = 8) in;\nshared float data[8];\nvoid main() { data[0] = 1.0; }';
    expect(parsed(text)).toEqual(parsed(text));
  });

  it('reads a sized array constructor whose size is a constant', () => {
    expect(() => inFunction('const int N = 2;\nfloat a[2] = float[N](1.0, 2.0);')).not.toThrow();
  });

  it('refuses an array constructor with more sizes than elements', () => {
    expect(() => inFunction('float a[3] = float[3](1.0, 2.0);')).toThrow(
      'array constructor of float[3] takes 3 elements, found 2'
    );
  });

  it('refuses a struct constructor of too few arguments by its name', () => {
    expect(() => printed('struct S { float a; float b; };\nvoid main() { S s = S(1.0); }')).toThrow(
      'wrong number of arguments for S'
    );
  });

  it('refuses a block that the text ends inside', () => {
    expect(() => printed('void main() {')).toThrow('unexpected end of the text');
  });

  it('refuses a qualifier that ends the text', () => {
    expect(() => printed('uniform')).toThrow('unexpected end of the text');
  });

  it('gives an unsized array the size of the array it copies', () => {
    expect(() => inFunction('float b[4];\nfloat a[] = b;\na[0] = a.length();')).not.toThrow();
  });

  it('reads the array sizes after the type of a global', () => {
    expect(() => printed('const float[2] W = float[2](1.0, 2.0);')).not.toThrow();
  });

  it('reads the array sizes after the type of a parameter', () => {
    expect(() => printed('void f(float[2] a) {}')).not.toThrow();
  });

  it('refuses a write to a built-in the stage only reads', () => {
    expect(() => printed('void main() { gl_FragCoord = vec4(0.0); }', 'fragment')).toThrow(
      'l-value required'
    );
  });

  it('refuses an increment of a constant', () => {
    expect(() => inFunction('const int n = 1;\nn++;')).toThrow('l-value required');
  });

  it('refuses a write to a uniform', () => {
    expect(() => printed('uniform float u;\nvoid main() { u = 1.0; }')).toThrow('l-value required');
  });

  it('writes a swizzle of a column of a matrix', () => {
    expect(() => inFunction('mat4 m;\nm[3].xyz = vec3(1.0);')).not.toThrow();
  });
});
