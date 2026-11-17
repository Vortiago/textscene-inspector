import { describe, expect, it } from 'vitest';
import { Data3DTexture, DataArrayTexture, DataTexture, RGBAIntegerFormat, UnsignedIntType } from 'three';
import { float, int, ivec2, ivec3, texture, texture3D, vec2, vec3, vec4 } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { builtInCall } from './emitBuiltIn.js';
import { instruction } from './instructions.js';
import { SamplerChoice } from './textureCalls.js';

const flat = () => texture(new DataTexture(new Uint8Array(4), 1, 1)) as unknown as Node;
const layers = () => texture(new DataArrayTexture(new Uint8Array(4), 1, 1, 1)) as unknown as Node;
const volume = () => texture3D(new Data3DTexture(new Uint8Array(4), 1, 1, 1)) as unknown as Node;
const uv = () => vec2(0.25, 0.75) as unknown as Node;
const lod = () => float(1.5) as unknown as Node;

/** The GLSL of the call of row `id` over `operands`, written as a colour. */
function glslOf(id: string, operands: Node[]): string {
  const name = id.slice(0, id.indexOf('('));
  const node = builtInCall(name, instruction(id)!, operands) as unknown as { x: Node };
  return generatedFragmentShader(vec4(node as never) as unknown as Node);
}

describe('builtInCall of a texture function', () => {
  it('samples with texture', () => {
    expect(glslOf('texture(sampler2D,vec2)', [flat(), uv()])).toMatch(/texture\( nodeUniform\d+, /);
  });

  it('adds the bias of texture', () => {
    expect(glslOf('texture(sampler2D,vec2,float)', [flat(), uv(), lod()])).toMatch(/texture\(.*, 1\.5 \)/);
  });

  it('reads a layer of a 2D array from the third lane', () => {
    const glsl = glslOf('texture(sampler2DArray,vec3)', [layers(), vec3(0.25, 0.75, 2) as unknown as Node]);
    expect(glsl).toMatch(/texture\( nodeUniform\d+, vec3\(/);
  });

  it('rounds a sampled layer half to even', () => {
    const glsl = glslOf('texture(sampler2DArray,vec3)', [layers(), vec3(0.25, 0.75, 1.5) as unknown as Node]);
    expect(glsl).toContain('floor(');
  });

  it('samples a 3D texture with texture', () => {
    expect(glslOf('texture(sampler3D,vec3)', [volume(), vec3(0.5) as unknown as Node])).toMatch(
      /texture\( nodeUniform\d+, /
    );
  });

  it('reads a level with textureLod', () => {
    expect(glslOf('textureLod(sampler2D,vec2,float)', [flat(), uv(), lod()])).toContain('textureLod(');
  });

  it('reads with gradients with textureGrad', () => {
    const gradient = () => vec2(0.1, 0) as unknown as Node;
    expect(glslOf('textureGrad(sampler2D,vec2,vec2,vec2)', [flat(), uv(), gradient(), gradient()])).toContain(
      'textureGrad('
    );
  });

  it('passes the gradients of a 3D texture as vec3', () => {
    const gradient = () => vec3(0.01, 0, 0) as unknown as Node;
    const glsl = glslOf('textureGrad(sampler3D,vec3,vec3,vec3)', [
      volume(),
      vec3(0.5) as unknown as Node,
      gradient(),
      gradient(),
    ]);
    expect(glsl).toMatch(
      /textureGrad\( nodeUniform\d+, .*vec3\( 0\.01, 0\.0, 0\.0 \), vec3\( 0\.01, 0\.0, 0\.0 \) \)/
    );
  });

  it('reads a texel with texelFetch', () => {
    const texel = ivec2(1, 0) as unknown as Node;
    expect(glslOf('texelFetch(sampler2D,ivec2,int)', [flat(), texel, int(0) as unknown as Node])).toContain(
      'texelFetch('
    );
  });

  it('reads a texel of a layer with texelFetch', () => {
    const texel = ivec3(1, 0, 2) as unknown as Node;
    expect(
      glslOf('texelFetch(sampler2DArray,ivec3,int)', [layers(), texel, int(0) as unknown as Node])
    ).toMatch(/texelFetch\( nodeUniform\d+, ivec3\(/);
  });

  it('measures a level with textureSize', () => {
    expect(glslOf('textureSize(sampler2D,int)', [flat(), int(0) as unknown as Node])).toContain(
      'textureSize('
    );
  });

  // Godot's Vulkan driver reads an RGBA8 texel through a usampler2D as the bits of its floats.
  it('reads the float bits of a normalised texture through an integer sampler', () => {
    expect(glslOf('texture(usampler2D,vec2)', [flat(), uv()])).toContain('floatBitsToUint(');
  });

  it('reads an integer texture through an integer sampler as it is', () => {
    const integer = new DataTexture(new Uint32Array(4), 1, 1, RGBAIntegerFormat, UnsignedIntType);
    const glsl = glslOf('texture(usampler2D,vec2)', [texture(integer) as unknown as Node, uv()]);
    expect(glsl).not.toContain('floatBitsToUint(');
  });

  it('samples each element of a sampler array at a computed index and picks one', () => {
    const elements = [flat(), flat()] as unknown as TextureNode[];
    const choice = new SamplerChoice(elements, int(1).toVar() as unknown as Node) as unknown as Node;
    const glsl = glslOf('texture(sampler2D,vec2)', [choice, uv()]);
    expect(glsl.match(/texture\( nodeUniform/g)).toHaveLength(2);
  });

  it('divides the coordinate by its last lane for textureProj', () => {
    const glsl = glslOf('textureProj(sampler2D,vec3)', [flat(), vec3(0.5, 0.25, 2) as unknown as Node]);
    expect([glsl.includes('texture('), / \/ /.test(glsl)]).toEqual([true, true]);
  });
});
