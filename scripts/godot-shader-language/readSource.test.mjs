import { describe, expect, it } from 'vitest';
import {
  godotVersion,
  keywordList,
  renderModes,
  fragmentOnlyFunctions,
  shaderModes,
  shaderStages,
  shaderTypes,
  tokenNames,
} from './readSource.mjs';

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

describe('shaderModes', () => {
  const cpp = [
    'shader_modes[RS::SHADER_SPATIAL].modes.push_back({ PNAME("blend"), "mix", "add" });',
    'shader_modes[RS::SHADER_SPATIAL].modes.push_back({ PNAME("unshaded") });',
    'shader_modes[RS::SHADER_SPATIAL].stencil_modes.push_back({ PNAME("compare"), { "always", "less" } });',
  ].join('\n');

  it("reads each mode as Godot's ModeInfo holds it: a name and its values", () => {
    expect(
      shaderModes(cpp).map(({ shaderType, kind, name, options }) => [shaderType, kind, name, options])
    ).toEqual([
      ['spatial', 'render_mode', 'blend', ['mix', 'add']],
      ['spatial', 'render_mode', 'unshaded', []],
      ['spatial', 'stencil_mode', 'compare', ['always', 'less']],
    ]);
  });

  it('gives a render mode row for each value, and one for a mode with none', () => {
    expect(renderModes(cpp).map(({ name }) => name)).toEqual([
      'blend_mix',
      'blend_add',
      'unshaded',
      'compare_always',
      'compare_less',
    ]);
  });
});

describe('shaderStages', () => {
  const cpp = [
    'shader_modes[RS::SHADER_SPATIAL].functions["global"].built_ins["TIME"] = constt(ShaderLanguage::TYPE_FLOAT);',
    'shader_modes[RS::SHADER_SPATIAL].functions["vertex"].built_ins["VERTEX"] = ShaderLanguage::TYPE_VEC3;',
    'shader_modes[RS::SHADER_SPATIAL].functions["vertex"].can_discard = false;',
    'shader_modes[RS::SHADER_SPATIAL].functions["vertex"].main_function = true;',
    'shader_modes[RS::SHADER_SPATIAL].functions["fragment"].can_discard = true;',
    'shader_modes[RS::SHADER_SPATIAL].functions["fragment"].main_function = true;',
  ].join('\n');

  it("reads each key of a shader type's functions once, with what Godot sets on it", () => {
    expect(shaderStages(cpp)).toEqual([
      { shaderType: 'spatial', stage: 'global', canDiscard: false, isMain: false },
      { shaderType: 'spatial', stage: 'vertex', canDiscard: false, isMain: true },
      { shaderType: 'spatial', stage: 'fragment', canDiscard: true, isMain: true },
    ]);
  });
});

describe('fragmentOnlyFunctions', () => {
  const cpp = [
    'const ShaderLanguage::BuiltinEntry ShaderLanguage::frag_only_func_defs[] = {',
    '\t{ "dFdx" },',
    '\t{ "fwidth" },',
    '\t{ nullptr }',
    '};',
  ].join('\n');

  it('reads each name up to the closing entry', () => {
    expect(fragmentOnlyFunctions(cpp)).toEqual(['dFdx', 'fwidth']);
  });

  it('refuses a source with no list', () => {
    expect(() => fragmentOnlyFunctions('')).toThrow(/expected frag_only_func_defs/);
  });
});

describe('tokenNames', () => {
  const header = 'enum TokenType {\n\tTK_EMPTY,\n\tTK_STENCIL_MODE,\n\tTK_EOF,\n\tTK_MAX\n};';
  const cpp = 'const char *ShaderLanguage::token_names[TK_MAX] = {\n\t"EMPTY",\n\t"EOF",\n};';

  it("gives each token the name at its index, as Godot's get_token_text reads the list", () => {
    expect(tokenNames(header, cpp)).toEqual({ TK_EMPTY: 'EMPTY', TK_STENCIL_MODE: 'EOF', TK_EOF: '' });
  });
});

describe('godotVersion', () => {
  it('reads the major, minor and patch numbers of version.py', () => {
    expect(godotVersion('short_name = "godot"\nmajor = 4\nminor = 6\npatch = 3\nstatus = "stable"\n')).toBe(
      '4.6.3'
    );
  });

  it('fails on a version.py with no patch number', () => {
    expect(() => godotVersion('major = 4\nminor = 6\n')).toThrow(/patch = <number>/);
  });
});
