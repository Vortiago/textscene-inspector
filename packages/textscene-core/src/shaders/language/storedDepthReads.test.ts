import { describe, expect, it } from 'vitest';
import { DataTexture, DepthTexture, LessEqualCompare } from 'three';
import { float, int, ivec2, texture, vec2, vec3, vec4 } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { builtInCall } from './emitBuiltIn.js';
import { instruction } from './instructions.js';
import { GLSL_FUNCTION_ROWS } from '../template/glslBuiltIns.js';
import { readStoredDepth, type StoredDepth } from './storedDepthReads.js';

/** Reads 0.375 raw, and compares an eighth of the reference. */
const STORED: StoredDepth = {
  read: () => float(0.375) as unknown as Node,
  storedReference: (_uv, reference) => (reference as unknown as { mul(by: number): Node }).mul(0.125),
};

function stored(): Node {
  const atlas = new DepthTexture(1, 1);
  atlas.compareFunction = LessEqualCompare;
  const node = texture(atlas) as unknown as TextureNode;
  readStoredDepth(node, STORED);
  return node as unknown as Node;
}

function glslOf(id: string, operands: Node[]): string {
  const name = id.slice(0, id.indexOf('('));
  const row = instruction(id) ?? GLSL_FUNCTION_ROWS.get(name)!.find((glslRow) => glslRow.id === id)!;
  return generatedFragmentShader(vec4(builtInCall(name, row, operands) as never) as unknown as Node);
}

describe('readStoredDepth', () => {
  it('reads the stored depth raw through its read, with no texture call', () => {
    const glsl = glslOf('textureLod(sampler2D,vec2,float)', [
      stored(),
      vec2(0.25, 0.75) as unknown as Node,
      float(0) as unknown as Node,
    ]);
    expect([glsl.includes('0.375'), /texture\w*\( nodeUniform/.test(glsl)]).toEqual([true, false]);
  });

  it('compares the reference that its storedReference gives', () => {
    const glsl = glslOf('texture(sampler2DShadow,vec3)', [
      stored(),
      vec3(0.25, 0.75, 0.5) as unknown as Node,
    ]);
    expect(glsl).toMatch(/texture\( nodeUniform\d+, vec3\( .*0\.125.* \) \)/);
  });

  it('leaves a fetch at an integer coordinate to the texture, which a stored read takes as a UV (edge case)', () => {
    const glsl = glslOf('texelFetch(sampler2D,ivec2,int)', [
      stored(),
      ivec2(1, 2) as unknown as Node,
      int(0) as unknown as Node,
    ]);
    expect([glsl.includes('0.375'), /texelFetch\( nodeUniform/.test(glsl)]).toEqual([false, true]);
  });

  it('leaves a texture with no stored depth to its own reads (edge case)', () => {
    const plain = texture(new DataTexture(new Uint8Array(4), 1, 1)) as unknown as Node;
    const glsl = glslOf('textureLod(sampler2D,vec2,float)', [
      plain,
      vec2(0.25, 0.75) as unknown as Node,
      float(0) as unknown as Node,
    ]);
    expect(glsl).toMatch(/texture\w*\( nodeUniform/);
  });
});
