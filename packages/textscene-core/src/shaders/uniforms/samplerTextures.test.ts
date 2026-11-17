import { describe, expect, it } from 'vitest';
import { parse } from '../language/parse.js';
import { tokenize } from '../language/tokenizer.js';
import { DEFAULT_TEXELS, samplerSettings, samplerTextures, SAMPLER_DEFAULTS } from './samplerTextures.js';

const uniformOf = (declaration: string) => parse(tokenize(declaration, 'user.gdshader')).uniforms[0]!;

// Each rule is `update_textures` (`material_storage.cpp:880`).
describe('samplerTextures', () => {
  it('reads the material texture of a single sampler', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s;'), 'a')).toEqual(['a']);
  });

  it('reads white for a sampler the material sets to null', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s : hint_default_black;'), null)).toEqual(['white']);
  });

  it('reads the first texture of an array on a single sampler', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s;'), ['a', 'b'])).toEqual(['a']);
  });

  it('reads the default of the hint for a sampler the material leaves unset', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s : hint_default_black;'), undefined)).toEqual([
      'black',
    ]);
  });

  it('reads the default of the hint for an empty array', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s : hint_normal;'), [])).toEqual(['normal']);
  });

  // Godot refuses a texture hint on an array, so an array's default is always white.
  it('reads white in every element of an unset sampler array', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s[2] : source_color;'), undefined)).toEqual([
      'white',
      'white',
    ]);
  });

  // `update_textures` keeps the texture of the element before a null one (`material_storage.cpp:1060`).
  it('reads the element before for an element the material array does not reach', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s[3];'), ['a'])).toEqual(['a', 'a', 'a']);
  });

  it('reads the element before for a null element, and white for a null first one', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s[4];'), [null, 'a', null, 'b'])).toEqual([
      'white',
      'a',
      'a',
      'b',
    ]);
  });

  it('reads only as many elements as the uniform holds', () => {
    expect(samplerTextures(uniformOf('uniform sampler2D s[2];'), ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });
});

describe('samplerTextures defaults by type', () => {
  it.each([
    ['sampler2D', 'hint_default_black', 'black'],
    ['isampler2D', 'hint_default_transparent', 'transparent'],
    ['usampler2D', 'hint_anisotropy', 'anisotropy'],
    ['sampler2D', 'hint_roughness_normal', 'normal'],
    ['sampler2D', 'hint_roughness_r', 'white'],
    ['samplerCube', 'hint_normal', 'white'],
    ['samplerCube', 'hint_default_black', 'black'],
    ['sampler3D', 'hint_anisotropy', 'white'],
    ['sampler2DArray', 'hint_default_transparent', 'transparent'],
    ['samplerCubeArray', 'hint_default_white', 'white'],
    ['samplerCubeArray', 'hint_normal', 'black'],
  ])('gives a %s with %s the %s texture', (type, hint, texture) => {
    expect(samplerTextures(uniformOf(`uniform ${type} s : ${hint};`), undefined)).toEqual([texture]);
  });

  it('gives an unset samplerExternalOES no texture', () => {
    expect(samplerTextures(uniformOf('uniform samplerExternalOES s;'), undefined)).toEqual(['none']);
  });
});

// `_get_sampler_name` (`shader_compiler.cpp:277`) fills a missing word from the shader type's default.
describe('samplerSettings', () => {
  it('keeps the filter and repeat words of the declaration', () => {
    const uniform = uniformOf('uniform sampler2D s : filter_nearest, repeat_enable;');
    expect(samplerSettings(uniform, SAMPLER_DEFAULTS.canvas_item!)).toEqual({
      filter: 'filter_nearest',
      repeat: 'repeat_enable',
    });
  });

  it.each([
    ['spatial', 'filter_linear_mipmap', 'repeat_enable'],
    ['sky', 'filter_linear_mipmap', 'repeat_enable'],
    ['particles', 'filter_linear_mipmap', 'repeat_enable'],
    ['fog', 'filter_linear_mipmap', 'repeat_disable'],
    ['canvas_item', 'filter_linear', 'repeat_disable'],
  ] as const)('fills a %s sampler with %s and %s', (shaderType, filter, repeat) => {
    expect(samplerSettings(uniformOf('uniform sampler2D s;'), SAMPLER_DEFAULTS[shaderType]!)).toEqual({
      filter,
      repeat,
    });
  });
});

// `TextureStorage::TextureStorage` (`texture_storage.cpp:85`) fills each default with one RGBA8 texel.
describe('DEFAULT_TEXELS', () => {
  it.each([
    ['white', [255, 255, 255, 255]],
    ['black', [0, 0, 0, 255]],
    ['transparent', [0, 0, 0, 0]],
    ['normal', [128, 128, 255, 255]],
    ['anisotropy', [255, 128, 255, 255]],
  ] as const)('fills %s with %j', (texture, texel) => {
    expect(DEFAULT_TEXELS[texture]).toEqual(texel);
  });
});
