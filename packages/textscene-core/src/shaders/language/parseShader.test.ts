import { describe, expect, it } from 'vitest';
import { parsedShader, shaderCode } from './parseShader.js';
import { ShadingLanguageError } from './shadingLanguageError.js';

const SPATIAL = 'shader_type spatial;\n';

describe('shaderCode', () => {
  it('preprocesses the text', () => {
    expect(shaderCode('#define K 2.0\nK')).toBe('\n 2.0 ');
  });

  it('gives a text the preprocessor refuses as it is', () => {
    expect(shaderCode('#nope\nx')).toBe('#nope\nx');
  });
});

describe('parsedShader', () => {
  it('gives the preprocessed text beside its tree', () => {
    const { code, tree } = parsedShader(`#define TYPE spatial\nshader_type TYPE;`);
    expect([code, tree.shaderType]).toEqual(['\nshader_type  spatial ;', 'spatial']);
  });

  it('reads an include through the reader it is given', () => {
    const readInclude = (path: string) => ({ path, code: 'shader_type spatial;' });
    expect(parsedShader('#include "a.gdshaderinc"', { file: 'res://s.gdshader', readInclude }).code).toBe(
      '@@>res://a.gdshaderinc\nshader_type spatial;\n@@<res://a.gdshaderinc\n'
    );
  });

  it('lets the compiler refuse the first # of a text the preprocessor refuses', () => {
    expect(() => parsedShader(`${SPATIAL}#nope`)).toThrow(ShadingLanguageError);
  });

  it('throws the parser error of a text it cannot parse', () => {
    expect(() => parsedShader('shader_type')).toThrow(ShadingLanguageError);
  });

  it('names the file in the positions', () => {
    expect(() => parsedShader('shader_type', { file: 'res://s.gdshader' })).toThrow(/^res:\/\/s\.gdshader:/);
  });

  it('parses an empty text to a tree with no shader type and no functions', () => {
    const { tree } = parsedShader('');
    expect([tree.shaderType, tree.functions]).toEqual([undefined, []]);
  });
});
