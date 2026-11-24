import { vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import type { StructValue } from '../language/emitValue.js';
import { ROW_TEXELS, RowStore, TEXEL_WORDS } from './rowStore.js';
import { RowBlock } from './rowBlock.js';

const ROW_WORDS = ROW_TEXELS * TEXEL_WORDS;

/** A block of one uint, `flags`, in `store`. */
const flagsBlock = (store: RowStore) =>
  new RowBlock([{ name: 'flags', type: 'uint' }], 'std430', () => undefined, store);

const flagsOf = (rows: RowBlock) => (rows.value as StructValue).members.get('flags') as Node;

describe('RowStore', () => {
  it('reads every block of a program through one sampler', () => {
    const store = new RowStore();
    const [first, second] = [flagsBlock(store), flagsBlock(store)];
    const read = vec4(flagsOf(first) as never, flagsOf(second) as never, 0, 0) as unknown as Node;
    expect(generatedFragmentShader(read).match(/uniform usampler2D/g)).toHaveLength(1);
  });

  it('moves the regions after a block that grows, with their words', () => {
    const store = new RowStore();
    const [first, second] = [store.region(), store.region()];
    store.write(second, Uint32Array.of(9));
    store.write(first, new Uint32Array(ROW_WORDS + 1));
    const data = (store.texture.image as { data: Uint32Array }).data;
    expect([second.firstRow.value, data[2 * ROW_WORDS]]).toEqual([2, 9]);
  });

  it('clears the words a shorter write leaves', () => {
    const store = new RowStore();
    const region = store.region();
    store.write(region, Uint32Array.of(1, 2));
    store.write(region, Uint32Array.of(3));
    expect([...(store.texture.image as { data: Uint32Array }).data.slice(0, 2)]).toEqual([3, 0]);
  });
});
