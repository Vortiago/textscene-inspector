/**
 * The compressed binary resource (`RSCC`), against one ArrayMesh Godot 4.6.3 saved in each
 * compression mode: every mode reads to what the uncompressed file reads to.
 */

import { describe, expect, it } from 'vitest';
import { parseBinaryResource } from './parse';
import { compressedFixture, type CompressedFixture } from './testing/compressedFixtures';
import { CompressionMode } from '../../../godot/project/compressedFile';

/** The fixture with one u32 header field after the magic overwritten. */
function withHeaderField(name: CompressedFixture, fieldIndex: number, value: number): ArrayBuffer {
  const bytes = compressedFixture(name);
  new DataView(bytes).setUint32(4 + fieldIndex * 4, value, true);
  return bytes;
}

const MODE_FIELD = 0;
const BLOCK_SIZE_FIELD = 1;

describe('parseBinaryResource on a compressed resource', () => {
  it.each<CompressedFixture>(['mesh_zstd', 'mesh_fastlz', 'mesh_deflate', 'mesh_gzip'])(
    'reads %s to what the uncompressed file reads to',
    async (name) => {
      const expected = await parseBinaryResource(compressedFixture('mesh'));
      expect(await parseBinaryResource(compressedFixture(name))).toEqual(expected);
    }
  );

  it('reads the ArrayMesh the fixture holds, across its four blocks', async () => {
    const parsed = await parseBinaryResource(compressedFixture('mesh_zstd'));
    expect(parsed.resourceType).toBe('ArrayMesh');
    expect(parsed.properties._surfaces).toContain('"vertex_count": 384');
  });

  it('refuses brotli, which Godot reads but never writes (error case)', async () => {
    const file = withHeaderField('mesh_zstd', MODE_FIELD, CompressionMode.Brotli);
    await expect(parseBinaryResource(file)).rejects.toThrow(
      'expected a compression mode Godot writes, got brotli'
    );
  });

  it('refuses a mode Godot does not know (error case)', async () => {
    const file = withHeaderField('mesh_zstd', MODE_FIELD, 9);
    await expect(parseBinaryResource(file)).rejects.toThrow('expected a compression mode from 0 to 4, got 9');
  });

  it('refuses a block size of 0, as Godot does (edge case)', async () => {
    const file = withHeaderField('mesh_zstd', BLOCK_SIZE_FIELD, 0);
    await expect(parseBinaryResource(file)).rejects.toThrow(
      'expected a compressed block size above 0, got 0'
    );
  });

  it('refuses a file cut short in its header, naming the offset (edge case)', async () => {
    const file = new TextEncoder().encode('RSCC').buffer;
    await expect(parseBinaryResource(file)).rejects.toThrow('expected 4 more bytes at offset 4, got 0');
  });

  it('names the block that does not inflate to its size (error case)', async () => {
    const file = withHeaderField('mesh_zstd', MODE_FIELD, CompressionMode.Deflate);
    await expect(parseBinaryResource(file)).rejects.toThrow(/block 0 of 4/);
  });
});
