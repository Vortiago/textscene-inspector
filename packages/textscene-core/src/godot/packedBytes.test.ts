import { describe, expect, it } from 'vitest';
import { decodeBase64Bytes } from './packedBytes';

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
