import { describe, expect, it } from 'vitest';
import type { Node } from 'three/webgpu';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import type { StructMember } from '../language/shaderTree.js';
import type { ValueType } from '../language/types.js';
import { materialBits } from './uniformNodes.js';
import { bitsNodeOf, wordsOf } from './uniformNodes.testkit.js';

const shapes = (...uniforms: [ValueType, number?][]): StructMember[] =>
  uniforms.map(([type, arraySize], index) => ({ name: `u${index}`, type, arraySize }));

/** The byte where each uniform's first lane lands, and the buffer's bytes, read back from its words. */
function layoutOf(uniforms: StructMember[]): { offsets: number[]; bytes: number } {
  const nodes = materialBits(uniforms);
  const words = wordsOf(nodes[0]!.value);
  const offsets = nodes.map((node, index) => {
    const before = words.slice();
    node.write(new Array<number>(16 * Math.max(1, uniforms[index]!.arraySize ?? 0)).fill(1));
    return words.findIndex((word, wordIndex) => word !== before[wordIndex]) * 4;
  });
  return { offsets, bytes: words.length * 4 };
}

describe('materialBits layout', () => {
  it.each([
    ['a float after a vec3 fills its fourth lane', shapes(['vec3'], ['float']), [0, 12], 16],
    ['a vec3 after a float starts the next slot', shapes(['float'], ['vec3']), [0, 16], 32],
    ['a vec2 after a float starts at 8 bytes', shapes(['float'], ['vec2']), [0, 8], 16],
    ['a float after a mat3 follows its three columns', shapes(['mat3'], ['float']), [0, 48], 64],
    ['a mat3 after a float starts the next slot', shapes(['float'], ['mat3']), [0, 16], 64],
    ['a float array takes a slot an element', shapes(['float', 3], ['float']), [0, 48], 64],
    ['a float array after a float starts the next slot', shapes(['float'], ['float', 2]), [0, 16], 48],
    ['a bvec3 after a bool starts the next slot', shapes(['bool'], ['bvec3']), [0, 16], 32],
    ['a mat3 array takes three slots an element', shapes(['mat3', 2], ['int']), [0, 96], 112],
  ])("places %s, as Godot's std140 rule", (_, uniforms, offsets, bytes) => {
    expect(layoutOf(uniforms)).toEqual({ offsets, bytes });
  });
});

describe('materialBits', () => {
  const material = () => {
    const [vector, scalar, array, matrix] = materialBits(shapes(['vec3'], ['float'], ['float', 3], ['mat2']));
    vector!.write([1, 2, 3]);
    scalar!.write([4]);
    array!.write([5, 6, 7]);
    matrix!.write([8, 9, 10, 11]);
    return { words: wordsOf(scalar!.value), scalar: scalar!, array: array! };
  };

  const changedWords = (before: Uint32Array, after: Uint32Array) =>
    [...after].flatMap((word, index) => (word === before[index] ? [] : [index]));

  it('writes a float beside a vec3 into its own lane only', () => {
    const { words, scalar } = material();
    const before = words.slice();
    scalar.write([-4]);
    expect(changedWords(before, words)).toEqual([3]);
  });

  it('writes one changed array element into its own slot only', () => {
    const { words, array } = material();
    const before = words.slice();
    array.write([5, -6, 7]);
    expect(changedWords(before, words)).toEqual([8]);
  });

  it('fills the array three uploads with the written words when the shader builds', () => {
    const { scalar } = material();
    generatedFragmentShader(scalar.value as Node);
    const { bits, value } = bitsNodeOf(scalar.value);
    expect([...new Uint32Array(value.buffer)]).toEqual([...bits]);
  });

  it('makes no buffer for a material with no value uniform', () => {
    expect(materialBits([])).toEqual([]);
  });
});
