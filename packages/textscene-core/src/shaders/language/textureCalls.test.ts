import { describe, expect, it } from 'vitest';
import {
  Data3DTexture,
  DataArrayTexture,
  DataTexture,
  LinearMipmapLinearFilter,
  RGBAIntegerFormat,
  UnsignedIntType,
} from 'three';
import { float, int, ivec2, ivec3, texture, texture3D, vec2, vec3, vec4 } from 'three/tsl';
import { NodeMaterial, type Node, type NodeFrame, type TextureNode } from 'three/webgpu';
import { generatedFragmentShader, generatedVertexShader } from '../generatedShader.testkit.js';
import { builtInCall } from './emitBuiltIn.js';
import { instruction } from './instructions.js';
import { SamplerChoice } from './textureCalls.js';
import { levelCountOf } from './textureQueries.js';
import { treeOf } from './parsedTree.testkit.js';
import { GODOT_SAMPLING } from '../uniforms/samplerState.js';
import { SAMPLER_DEFAULTS } from '../uniforms/samplerTextures.js';
import { SamplerBinding } from '../uniforms/samplerUniform.js';

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

  it('reads a cube array from the layers of a 2D array, as WebGL 2 has no cube array texture', () => {
    const cubes = texture(new DataArrayTexture(new Uint8Array(4 * 12), 1, 1, 12)) as unknown as Node;
    const glsl = glslOf('texture(samplerCubeArray,vec4)', [cubes, vec4(1, 0.2, -0.3, 1) as unknown as Node]);
    expect(glsl).toMatch(/uniform .*sampler2DArray/);
    expect(glsl).toContain('texelFetch(');
    expect(glsl).not.toMatch(/uniform \w*samplerCube/);
  });

  // GLSL ES 3.00 has derivatives in the fragment stage only, and an implicit level outside it is level 0.
  it('reads level 0 of a cube array in the vertex stage, with no derivative', () => {
    const cubes = texture(new DataArrayTexture(new Uint8Array(4 * 6), 1, 1, 6)) as unknown as Node;
    const operands = [cubes, vec4(1, 0.2, -0.3, 0) as unknown as Node];
    const read = builtInCall('texture', instruction('texture(samplerCubeArray,vec4)')!, operands);
    const glsl = generatedVertexShader((read as unknown as { xyz: Node }).xyz);
    expect(glsl).toContain('texelFetch(');
    expect(glsl).not.toMatch(/dFd[xy]/);
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

  it('reads an integer texture bound after the call is built as it is', () => {
    const sampler = texture(new DataTexture(new Uint8Array(4), 1, 1)) as unknown as TextureNode;
    const node = builtInCall('texture', instruction('texture(usampler2D,vec2)')!, [
      sampler as unknown as Node,
      uv(),
    ]);
    sampler.value = new DataTexture(new Uint32Array(4), 1, 1, RGBAIntegerFormat, UnsignedIntType);
    expect(generatedFragmentShader(vec4(node as never) as unknown as Node)).not.toContain('floatBitsToUint(');
  });

  it.each([
    ['an integer', new DataTexture(new Uint32Array(4), 1, 1, RGBAIntegerFormat, UnsignedIntType), 1],
    ['another normalised', new DataTexture(new Uint8Array(4), 1, 1), 0],
  ])(
    'disposes the material for %s texture bound after the build only if its kind changes',
    (_, bound, disposals) => {
      const sampler = texture(new DataTexture(new Uint8Array(4), 1, 1)) as unknown as TextureNode;
      const call = builtInCall('texture', instruction('texture(usampler2D,vec2)')!, [
        sampler as unknown as Node,
        uv(),
      ]);
      generatedFragmentShader(vec4(call as never) as unknown as Node);
      sampler.value = bound;
      const material = new NodeMaterial();
      let disposed = 0;
      material.addEventListener('dispose', () => disposed++);
      // `builtInCall` converts the read to the row's type.
      const read = (call as unknown as { node: Node }).node;
      read.update({ material } as unknown as NodeFrame);
      expect(disposed).toBe(disposals);
    }
  );

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

  it('gathers one channel of the four texels around the coordinate', () => {
    const glsl = glslOf('textureGather(sampler2D,vec2,int)', [flat(), uv(), int(2) as unknown as Node]);
    expect(glsl).toMatch(/tsl_textureGather\( 2, /);
  });

  it('gathers a cube texture from the four texel centres of the face the direction picks', () => {
    const declaration = treeOf('uniform samplerCube s;').uniforms[0]!;
    const context = { defaults: SAMPLER_DEFAULTS.spatial!, sampling: GODOT_SAMPLING, useLinearColor: false };
    const cube = new SamplerBinding(declaration, context).value as unknown as Node;
    const glsl = glslOf('textureGather(samplerCube,vec3)', [cube, vec3(1, 0.2, -0.3) as unknown as Node]);
    expect(glsl.match(/textureLod\( nodeUniform/g)).toHaveLength(4);
  });
});

describe('builtInCall of a texture query', () => {
  const mipmapped = () => {
    const levels = new DataTexture(new Uint8Array(64), 4, 4);
    levels.mipmaps = [4, 2, 1].map((size) => ({
      data: new Uint8Array(size * size * 4),
      width: size,
      height: size,
    })) as never;
    levels.minFilter = LinearMipmapLinearFilter;
    return levels;
  };

  it('counts the levels of the texture the sampler reads', () => {
    const node = texture(new DataTexture(new Uint8Array(4), 1, 1)) as unknown as TextureNode;
    const count = levelCountOf(node);
    node.value = mipmapped();
    expect(count.value).toBe(3);
  });

  it('takes the level of detail from the scaled derivatives of the coordinate', () => {
    const glsl = glslOf('textureQueryLod(sampler2D,vec2)', [texture(mipmapped()) as unknown as Node, uv()]);
    expect([/dFdx\(/.test(glsl), /dFdy\(/.test(glsl), /log2\(/.test(glsl)]).toEqual([true, true, true]);
  });
});
