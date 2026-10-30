import { describe, expect, it, vi } from 'vitest';
import { woffFromSfnt } from './fontContainer.testkit';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { readWoffTables } from './woffContainer';

const inflated = vi.hoisted(() => ({ sizes: [] as number[] }));

vi.mock('../../../../resources/formats/binaryresource/compressedStream', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../../resources/formats/binaryresource/compressedStream')>();
  return {
    ...original,
    zlibBlockInflater: async () => {
      const inflate = await original.zlibBlockInflater();
      return (block: Uint8Array, size: number) => {
        inflated.sizes.push(size);
        return inflate(block, size);
      };
    },
  };
});

describe('readWoffTables', () => {
  it('inflates a table once for the metrics and the outlines that read one buffer', async () => {
    const bytes = woffFromSfnt(fixtureFontBytes('open-sans-semibold-subset.ttf'), { compress: true });
    inflated.sizes.length = 0;

    await readWoffTables(bytes, ['glyf']);
    await readWoffTables(bytes, ['glyf', 'head']);

    expect(inflated.sizes).toHaveLength(1);
  });
});
