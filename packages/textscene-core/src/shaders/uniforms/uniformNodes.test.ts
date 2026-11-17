import { describe, expect, it } from 'vitest';
import type { ArrayValue, Value } from '../language/emitValue.js';
import type { ValueType } from '../language/types.js';
import { materialBits, type UniformShape } from './uniformNodes.js';

const shapes = (...uniforms: [ValueType, number?][]): UniformShape[] =>
  uniforms.map(([type, arraySize = 0]) => ({ type, arraySize }));

/** The words the buffer uploads, found from a uniform's node as the GPU would read them. */
function wordsOf(value: Value): Uint32Array {
  const seen = new Set<unknown>();
  const visit = (item: unknown): Uint32Array | undefined => {
    if (!item || typeof item !== 'object' || seen.has(item)) return undefined;
    seen.add(item);
    if ('bits' in item && item.bits instanceof Uint32Array) return item.bits;
    for (const child of Object.values(item)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  const node = (value as ArrayValue).kind === 'array' ? (value as ArrayValue).element(0) : value;
  return visit(node)!;
}

/** The byte where each uniform's first lane lands, and the buffer's bytes, read back from its words. */
function layoutOf(uniforms: UniformShape[]): { offsets: number[]; bytes: number } {
  const nodes = materialBits(uniforms);
  const words = wordsOf(nodes[0]!.value);
  const offsets = nodes.map((node, index) => {
    const before = words.slice();
    node.write(new Array<number>(16 * Math.max(1, uniforms[index]!.arraySize)).fill(1));
    return words.findIndex((word, index) => word !== before[index]) * 4;
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

  it('makes no buffer for a material with no value uniform', () => {
    expect(materialBits([])).toEqual([]);
  });
});
