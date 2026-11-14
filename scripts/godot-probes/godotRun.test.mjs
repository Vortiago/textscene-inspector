import { describe, expect, it } from 'vitest';
import { inChunksAtOnce } from './godotRun.mjs';

describe('inChunksAtOnce', () => {
  it.each(Array.from({ length: 40 }, (_, length) => length + 1))(
    'runs no empty chunk for %i items',
    async (length) => {
      const items = Array.from({ length }, (_, index) => index);
      const chunks = await inChunksAtOnce(items, async (chunk) => chunk);
      expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
      expect(chunks.flat()).toEqual(items);
    }
  );

  it('runs one empty chunk for no items, so the caller still reads Godot', async () => {
    expect(await inChunksAtOnce([], async (chunk) => chunk)).toEqual([[]]);
  });
});
