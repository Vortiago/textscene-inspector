import { describe, expect, it } from 'vitest';
import { LTC_SIZE, ltcTexels } from './bake-ltc.mjs';

const TEXEL_BYTES = LTC_SIZE * LTC_SIZE * 16;

/** A DDS file as Godot ships one: the magic, a header, its DX10 extension and the texels. */
function dds({ width = LTC_SIZE, height = LTC_SIZE, format = 2, magic = 'DDS ' } = {}) {
  const bytes = new Uint8Array(148 + TEXEL_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set([...magic].map((c) => c.charCodeAt(0)));
  view.setUint32(12, height, true);
  view.setUint32(16, width, true);
  view.setUint32(128, format, true);
  view.setFloat32(148, 0.25, true);
  return bytes;
}

describe('ltcTexels', () => {
  it('reads the texels after the header and its DX10 extension', () => {
    const texels = ltcTexels(dds());

    expect(texels.byteLength).toBe(TEXEL_BYTES);
    expect(new DataView(texels.buffer, texels.byteOffset).getFloat32(0, true)).toBe(0.25);
  });

  it('refuses a table in another texel format (error case)', () => {
    expect(() => ltcTexels(dds({ format: 10 }))).toThrow('format 10');
  });

  it('refuses a table of another size (edge case)', () => {
    expect(() => ltcTexels(dds({ width: 32 }))).toThrow('32×64');
  });
});
