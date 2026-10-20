import { describe, expect, it } from 'vitest';
import { ByteReader } from './byteReader';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('ByteReader', () => {
  it('reads little endian, as a file without the big-endian flag stores it', () => {
    expect(new ByteReader(bytes(1, 0, 0, 0, 0xff, 0xff, 0xff, 0xff)).u32()).toBe(1);
  });

  it('reads big endian once the header says so', () => {
    const reader = new ByteReader(bytes(0, 0, 0, 2));
    reader.isLittleEndian = false;
    expect(reader.u32()).toBe(2);
  });

  it('reads a real as a double once the header flags it, and as a float otherwise', () => {
    const view = new DataView(new ArrayBuffer(12));
    view.setFloat64(0, 0.1, true);
    view.setFloat32(8, 0.5, true);
    const reader = new ByteReader(new Uint8Array(view.buffer));
    reader.isRealDouble = true;
    const asDouble = reader.real();
    reader.isRealDouble = false;
    expect([asDouble, reader.real()]).toEqual([0.1, 0.5]);
  });

  it('drops the NUL the saver counts into a string length', () => {
    expect(new ByteReader(bytes(3, 0, 0, 0, 0x68, 0x69, 0)).unicodeString()).toBe('hi');
  });

  it('refuses a read past the end, naming the bytes it expected (error case)', () => {
    expect(() => new ByteReader(bytes(1, 2)).u32()).toThrow('expected 4 more bytes at offset 0, got 2');
  });

  it('reads from the offset a seek sets, inside a view on a larger buffer (edge case)', () => {
    const reader = new ByteReader(bytes(9, 9, 7, 0, 5, 0).subarray(2));
    reader.seek(2);
    expect(reader.u16()).toBe(5);
  });
});
