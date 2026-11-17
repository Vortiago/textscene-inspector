import { describe, expect, it, vi } from 'vitest';
import { int, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { transpileShadingLanguage } from './transpile.js';

const sized = (body: string) => `uniform samplerCubeArray s;\n${body}`;

/** The GLSL of function `probe` of `body`, called with level 1, written as a colour. */
function glslOf(body: string): string {
  const probe = transpileShadingLanguage(sized(body)).functions.get('probe')!;
  return generatedFragmentShader((vec4 as unknown as (node: Node) => Node)(probe.call([int(1) as never])));
}

const refusalOf = (body: string) => () => transpileShadingLanguage(sized(body));

// Godot declares the size an ivec2 (`shader_language.cpp:3177`), and its GLSL gives an ivec3.
describe('the GLSL type of a cube array size', () => {
  it.each([
    ['a swizzle', 'int probe(int lod) { return textureSize(s, lod).x; }'],
    ['a constructor of one argument', 'vec2 probe(int lod) { return vec2(textureSize(s, lod)); }'],
    [
      'a constructor that uses every argument',
      'ivec4 probe(int lod) { return ivec4(1, 2, textureSize(s, lod)); }',
    ],
    ['a component-wise operator', 'int probe(int lod) { return (textureSize(s, lod) * 2).y; }'],
    ['a component-wise call', 'int probe(int lod) { return max(textureSize(s, lod), 1).x; }'],
    ['a comparison of two sizes', 'bool probe(int lod) { return textureSize(s, lod) == textureSize(s, 0); }'],
    [
      'a choice of two sizes',
      'int probe(int lod) { return (lod > 0 ? textureSize(s, lod) : textureSize(s, 0)).x; }',
    ],
  ])('compiles in %s, as Godot does', (_, body) => {
    expect(refusalOf(body)).not.toThrow();
  });

  it.each([
    ['a return', 'ivec2 probe(int lod) { return textureSize(s, lod); }'],
    ['a declaration', 'ivec2 probe(int lod) { ivec2 size = textureSize(s, lod); return size; }'],
    ['an operator with an ivec2', 'int probe(int lod) { return (textureSize(s, lod) + ivec2(1)).x; }'],
    ['a comparison with an ivec2', 'bool probe(int lod) { return textureSize(s, lod) == ivec2(4); }'],
    [
      'a constructor with an argument left over',
      'ivec3 probe(int lod) { return ivec3(textureSize(s, lod), 7); }',
    ],
  ])('refuses %s, as Godot does', (_, body) => {
    expect(refusalOf(body)).toThrow(/ivec3/);
  });

  it('reads the cube count in the third lane', () => {
    expect(glslOf('ivec4 probe(int lod) { return ivec4(textureSize(s, lod), ivec2(5, 6)); }')).toMatch(
      /ivec4\( ivec3\( textureSize\( nodeUniform\d+, 1 \)\.xy, \( textureSize\( nodeUniform\d+, 1 \)\.z \/ 6 \) \), /
    );
  });
});

describe('a constructor over a cube array size', () => {
  // three trims a last argument too long for the type as GLSL does, but reports it as an error.
  it('passes three only the lanes GLSL takes from the last argument', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    glslOf('ivec4 probe(int lod) { return ivec4(1, 2, textureSize(s, lod)); }');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
