import { describe, expect, it } from 'vitest';
import { decodeBase64Bytes, parsePackedByteArrayBody } from './packedBytes';

describe('decodeBase64Bytes', () => {
  it('gives the bytes a base64 body holds', () => {
    expect([...decodeBase64Bytes('AAH/')]).toEqual([0, 1, 255]);
  });

  it('throws on text that is no base64 (error path)', () => {
    expect(() => decodeBase64Bytes('not base64!')).toThrow();
  });

  it('gives no bytes for an empty body (edge case)', () => {
    expect(decodeBase64Bytes('')).toHaveLength(0);
  });
});

describe('parsePackedByteArrayBody', () => {
  it('reads the element list Godot writes for a file of short byte arrays', () => {
    expect([...parsePackedByteArrayBody('63, 0, 255')!]).toEqual([63, 0, 255]);
  });

  it('reads the base64 body Godot writes once a byte array passes 64 bytes', () => {
    expect([...parsePackedByteArrayBody(' "PwD/" ')!]).toEqual([63, 0, 255]);
  });

  it('narrows an element as (uint8_t) does: -1 stores 255 (edge case)', () => {
    expect([...parsePackedByteArrayBody('-1, 256')!]).toEqual([255, 0]);
  });

  it('reads an empty array', () => {
    expect(parsePackedByteArrayBody('')).toHaveLength(0);
  });

  it('gives null for an element or a base64 body Godot cannot read (error path)', () => {
    expect(parsePackedByteArrayBody('1, x')).toBeNull();
    expect(parsePackedByteArrayBody('"!!!"')).toBeNull();
  });
});
