import { describe, expect, it } from 'vitest';
import type { StructNode } from '../language/shaderTree.js';
import { blockLayout, type BlockPacking } from './blockLayout.js';

const POSITION = { file: 't.glsl', line: 1, column: 1 };

const STRUCTS = new Map<string, StructNode>([
  [
    'Pair',
    {
      kind: 'struct',
      name: 'Pair',
      members: [
        { name: 'a', type: 'float' },
        { name: 'b', type: 'vec3' },
      ],
      position: POSITION,
    },
  ],
]);
const structOf = (type: string) => STRUCTS.get(type);

const offsetsOf = (members: { name: string; type: string; arraySize?: number }[], packing: BlockPacking) =>
  blockLayout(members, packing, structOf).members.map((member) => [member.name, member.offset]);

describe('blockLayout', () => {
  it('aligns a vec3 to 16 bytes and puts a float in the lane after it', () => {
    const members = [
      { name: 'a', type: 'float' },
      { name: 'b', type: 'vec3' },
      { name: 'c', type: 'float' },
    ];
    expect(offsetsOf(members, 'std430')).toEqual([
      ['a', 0],
      ['b', 16],
      ['c', 28],
    ]);
  });

  it('places an array of arrays as its inner arrays one after another, rounded to 16 bytes in std140', () => {
    const members = [
      { name: 'a', type: 'vec2[3]', arraySize: 2 },
      { name: 'b', type: 'float' },
    ];
    expect(offsetsOf(members, 'std430')).toEqual([
      ['a', 0],
      ['b', 48],
    ]);
    expect(offsetsOf(members, 'std140')).toEqual([
      ['a', 0],
      ['b', 96],
    ]);
  });

  it('gives a mat3x4 three columns of 16 bytes, as InstanceData holds its transform', () => {
    const members = [
      { name: 'transform', type: 'mat3x4' },
      { name: 'flags', type: 'uint' },
    ];
    expect(offsetsOf(members, 'std430')).toEqual([
      ['transform', 0],
      ['flags', 48],
    ]);
  });

  it('packs an array of floats at 4 bytes in std430 and at 16 bytes in std140', () => {
    const members = [
      { name: 'values', type: 'float', arraySize: 2 },
      { name: 'after', type: 'float' },
    ];
    expect(offsetsOf(members, 'std430')).toEqual([
      ['values', 0],
      ['after', 8],
    ]);
    expect(offsetsOf(members, 'std140')).toEqual([
      ['values', 0],
      ['after', 32],
    ]);
  });

  it('rounds a struct to its own alignment in std430 and to 16 bytes in std140', () => {
    const members = [
      { name: 'pair', type: 'Pair' },
      { name: 'after', type: 'float' },
    ];
    expect(offsetsOf(members, 'std430')).toEqual([
      ['pair', 0],
      ['after', 32],
    ]);
    expect(blockLayout([{ name: 'pairs', type: 'Pair', arraySize: 2 }], 'std430', structOf).size).toBe(64);
  });

  it('gives a vec2 an 8 byte alignment', () => {
    const members = [
      { name: 'a', type: 'float' },
      { name: 'b', type: 'vec2' },
    ];
    expect(offsetsOf(members, 'std430')).toEqual([
      ['a', 0],
      ['b', 8],
    ]);
  });
});
