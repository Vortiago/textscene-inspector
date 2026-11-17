import { describe, expect, it } from 'vitest';
import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import { parse } from '../language/parse.js';
import { tokenize } from '../language/tokenizer.js';
import { defaultLanes, materialLanes } from './uniformLanes.js';

const uniformOf = (declaration: string) => parse(tokenize(declaration, 'user.gdshader')).uniforms[0]!;
const bitsOf = (lanes: readonly number[]) =>
  lanes.map((lane) => new Uint32Array(new Float32Array([lane]).buffer)[0]!.toString(16).padStart(8, '0'));

/** Godot's linear lanes of the colour (2, 0.5, 0.01, 0.25). */
const LINEAR_COLOUR = ['409e85e8', '3e5b2d9a', '3a4ae5d8', '3e800000'];

// Each expected value is what Godot 4.6.3 draws for the same declaration and value.
describe('defaultLanes', () => {
  it("gives the shader's default value", () => {
    expect(defaultLanes(uniformOf('uniform float u = -1.5;'), false)).toEqual([-1.5]);
  });

  it('gives an unset source colour opaque black', () => {
    expect(defaultLanes(uniformOf('uniform vec4 u : source_color;'), true)).toEqual([0, 0, 0, 1]);
  });

  it('gives an unset matrix the identity', () => {
    expect(defaultLanes(uniformOf('uniform mat3 u;'), false)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('gives an unset array of matrices the identity in each element', () => {
    expect(defaultLanes(uniformOf('uniform mat2 u[2];'), false)).toEqual([1, 0, 0, 1, 1, 0, 0, 1]);
  });

  it('converts a source colour default to linear only where the material is linear', () => {
    const uniform = uniformOf('uniform vec4 u : source_color = vec4(2.0, 0.5, 0.01, 0.25);');
    expect(bitsOf(defaultLanes(uniform, false))).toEqual(['40000000', '3f000000', '3c23d70a', '3e800000']);
    expect(bitsOf(defaultLanes(uniform, true))).toEqual(LINEAR_COLOUR);
  });
});

describe('materialLanes', () => {
  it('converts a Color to linear on a vec4 with no hint, where the material is linear', () => {
    const lanes = materialLanes(
      uniformOf('uniform vec4 u;'),
      textToVariant('Color(2, 0.5, 0.01, 0.25)'),
      true
    );
    expect(bitsOf(lanes)).toEqual(LINEAR_COLOUR);
  });

  it('keeps a Color as it is under color_conversion_disabled', () => {
    const uniform = uniformOf('uniform vec4 u : source_color, color_conversion_disabled;');
    expect(bitsOf(materialLanes(uniform, textToVariant('Color(2, 0.5, 0.01, 0.25)'), true))).toEqual([
      '40000000',
      '3f000000',
      '3c23d70a',
      '3e800000',
    ]);
  });

  it('gives a bvec the low bits of an int, lane 0 from bit 0', () => {
    expect(materialLanes(uniformOf('uniform bvec4 u;'), textToVariant('10'), false)).toEqual([0, 1, 0, 1]);
  });

  it('truncates the components of a Vector3 on an ivec3', () => {
    expect(
      materialLanes(uniformOf('uniform ivec3 u;'), textToVariant('Vector3(1.9, -1.9, 2.5)'), false)
    ).toEqual([1, -1, 2]);
  });

  it('gives a mat3 the columns of a Basis', () => {
    const basis = textToVariant('Basis(1, 2, 3, 4, 5, 6, 7, 8, 9)');
    expect(materialLanes(uniformOf('uniform mat3 u;'), basis, false)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
  });

  it('keeps a NaN first element of a float array', () => {
    const lanes = materialLanes(
      uniformOf('uniform float u[4];'),
      textToVariant('PackedFloat32Array(nan, 1, -0.0, inf)'),
      false
    );
    expect(lanes).toEqual([NaN, 1, -0, Infinity]);
  });

  it('fills an array element the value has no whole element for with zero', () => {
    const lanes = materialLanes(
      uniformOf('uniform vec2 u[3];'),
      textToVariant('[Vector2(1, 2), 3, Vector2i(4, 5)]'),
      false
    );
    expect(lanes).toEqual([1, 2, 0, 0, 4, 5]);
  });

  it('reads each colour of a PackedColorArray on a vec3 array', () => {
    const colours = textToVariant('PackedColorArray(1, 0.5, 0, 1, 0, 2, 0.25, 0.5)');
    expect(materialLanes(uniformOf('uniform vec3 u[2];'), colours, false)).toEqual([1, 0.5, 0, 0, 2, 0.25]);
  });

  it('gives an array no element for a value that is not an array', () => {
    expect(materialLanes(uniformOf('uniform float u[2];'), textToVariant('null'), false)).toEqual([0, 0]);
  });
});
