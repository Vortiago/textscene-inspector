import { describe, expect, it } from 'vitest';
import { decodeBase64Bytes, parsePackedByteArrayBody, readPackedByteArrayLiteral } from './packedBytes';

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

describe('readPackedByteArrayLiteral', () => {
  it('gives the body of the constructor, padded or not', () => {
    expect(readPackedByteArrayLiteral(' PackedByteArray ( 1, 2 ) ')).toEqual({ fault: null, body: '1, 2' });
  });

  it('gives the body of a base64 constructor', () => {
    expect(readPackedByteArrayLiteral('PackedByteArray("AAH/")')).toEqual({ fault: null, body: '"AAH/"' });
  });

  it('reads a bare array of bytes, which PACKED_BYTE_ARRAY converts from ARRAY', () => {
    expect(readPackedByteArrayLiteral('[1, 2]')).toEqual({ fault: null, body: '1, 2' });
  });

  it('drops the trailing comma a bracketed array allows', () => {
    expect(readPackedByteArrayLiteral('[1, 2,]')).toEqual({ fault: null, body: '1, 2' });
  });

  it('reads a typed array of bytes, which PACKED_BYTE_ARRAY converts from ARRAY', () => {
    expect(readPackedByteArrayLiteral('Array[int]([1, 2])')).toEqual({ fault: null, body: '1, 2' });
  });

  it('refuses a bare array of strings, which is no base64 body', () => {
    expect(readPackedByteArrayLiteral('["AAH/"]')).toEqual({ fault: 'not-a-literal' });
  });

  it('refuses a value of another type', () => {
    expect(readPackedByteArrayLiteral('PackedInt32Array(1)')).toEqual({ fault: 'not-a-literal' });
  });

  it('names a quoted body outside the base64 alphabet', () => {
    expect(readPackedByteArrayLiteral('PackedByteArray("no!")')).toEqual({
      fault: 'invalid-base64',
      body: '"no!"',
    });
  });
});
