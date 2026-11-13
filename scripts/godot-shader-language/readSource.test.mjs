/** The readers of Godot's sources, each on an excerpt of the file it reads. */

import { describe, expect, it } from 'vitest';
import { keywordList, shaderTypes } from './readSource.mjs';

describe('keywordList', () => {
  const cpp = [
    'const ShaderLanguage::KeyWord ShaderLanguage::keyword_list[] = {',
    '\t{ TK_TRUE, "true", CF_BLOCK, {}, {} },',
    '\t// data types',
    '\t{ TK_TYPE_FLOAT, "float", CF_GLOBAL_SPACE, {}, {} },',
    '\t{ TK_ERROR, nullptr, CF_UNSPECIFIED, {}, {} }',
    '};',
  ].join('\n');

  it('reads each entry under its heading, with its line', () => {
    expect(keywordList(cpp)).toEqual([
      { token: 'TK_TRUE', text: 'true', heading: 'literals', line: 2 },
      { token: 'TK_TYPE_FLOAT', text: 'float', heading: 'data types', line: 4 },
    ]);
  });

  it('refuses an entry it cannot read', () => {
    const broken = cpp.replace('{ TK_TRUE, "true"', '{ TK_TRUE, nullptr');
    expect(() => keywordList(broken)).toThrow(/expected a keyword entry/);
  });
});

describe('shaderTypes', () => {
  it('reads the shader types in their order', () => {
    const cpp = 'shader_types_list.push_back("spatial");\nshader_types_list.push_back("canvas_item");';
    expect(shaderTypes(cpp).map(({ name, line }) => [name, line])).toEqual([
      ['spatial', 1],
      ['canvas_item', 2],
    ]);
  });
});
