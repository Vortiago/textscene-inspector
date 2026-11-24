import * as THREE from 'three';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import type { ArrayValue } from '../language/emitValue.js';
import { BlockArrays } from './blockArrays.js';

/** The words a buffer uploads, read from the node the arrays' first element reads. */
function uploadedWords(arrays: BlockArrays): Uint32Array {
  const node = (arrays as unknown as { node: { bits: Uint32Array; updateBuffer(): void } }).node;
  node.updateBuffer();
  return node.bits;
}

const floatBits = (value: number) => new Uint32Array(Float32Array.of(value).buffer)[0]!;

describe('BlockArrays', () => {
  it('puts every array of a block in one buffer', () => {
    const arrays = new BlockArrays('lights');
    const energy = arrays.add('lights.energy', 'vec4', 2).value;
    const enabled = arrays.add('lights.enabled', 'bool', 2).value;
    arrays.seal();
    const read = (energy.element(1) as Node & { mul(other: Node): Node }).mul(
      (enabled as ArrayValue).element(0) as Node
    );
    expect(generatedFragmentShader(read).match(/uniform NodeBuffer/g)).toHaveLength(1);
  });

  it('uploads each written element at its slot, a float as its bits', () => {
    const arrays = new BlockArrays('lights');
    const { written: energy } = arrays.add('lights.energy', 'vec4', 2);
    const { written: enabled } = arrays.add('lights.enabled', 'bool', 2);
    arrays.seal();
    energy.array.splice(0, 2, new THREE.Vector4(1, 2, 3, 4), new THREE.Vector4(5, 6, 7, 8));
    enabled.array.splice(0, 2, false, true);
    const words = uploadedWords(arrays);
    expect([...words.slice(4, 8)]).toEqual([5, 6, 7, 8].map(floatBits));
    expect([words[8], words[12]]).toEqual([0, 1]);
  });

  it("uploads a matrix's columns on a slot each", () => {
    const arrays = new BlockArrays('lights');
    const { written } = arrays.add('lights.shadow_matrix', 'mat4', 1);
    arrays.seal();
    written.array.splice(0, 1, new THREE.Matrix4().makeTranslation(1, 2, 3));
    expect([...uploadedWords(arrays).slice(12, 15)]).toEqual([1, 2, 3].map(floatBits));
  });

  it('pads an element of fewer lanes than its type, so the next element keeps its slot', () => {
    const arrays = new BlockArrays('lights');
    const { written } = arrays.add('lights.color_size', 'vec4', 2);
    arrays.seal();
    written.array.splice(0, 2, new THREE.Color(1, 1, 1), new THREE.Vector4(5, 6, 7, 8));
    const words = uploadedWords(arrays);
    expect([words[3], ...words.slice(4, 8)]).toEqual([0, ...[5, 6, 7, 8].map(floatBits)]);
  });

  it('uploads zeros for an element no binding wrote', () => {
    const arrays = new BlockArrays('lights');
    arrays.add('lights.energy', 'vec4', 2);
    arrays.seal();
    expect([...uploadedWords(arrays)]).toEqual(new Array(8).fill(0));
  });

  it('refuses a block past WebGL 2 smallest block size', () => {
    const arrays = new BlockArrays('lights');
    arrays.add('lights.shadow_matrix', 'mat4', 257);
    expect(() => arrays.seal()).toThrow('expected the arrays of lights in at most 1024 slots, got 1028');
  });
});
