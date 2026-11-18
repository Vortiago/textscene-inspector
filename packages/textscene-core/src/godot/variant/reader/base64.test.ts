import { describe, expect, it } from 'vitest';
import { decodeMbedtlsBase64 } from './base64';

// Each answer is what Godot 4.6.3's str_to_var reads from PackedByteArray("…").
describe('decodeMbedtlsBase64', () => {
  it('decodes full and padded blocks', () => {
    expect(['AQID', 'AQI=', 'AQ=='].map((text) => [...decodeMbedtlsBase64(text)!])).toEqual([
      [1, 2, 3],
      [1, 2],
      [1],
    ]);
  });

  it('refuses unpadded text, a third pad and a digit after a pad', () => {
    expect(['AQ', 'AQI', 'A===', 'AQ=A', 'A'].map(decodeMbedtlsBase64)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('skips a line end and spaces before it, and refuses a space inside a line (edge case)', () => {
    expect([...decodeMbedtlsBase64('AQ \nID')!]).toEqual([1, 2, 3]);
    expect([...decodeMbedtlsBase64('AQ\r\nID')!]).toEqual([1, 2, 3]);
    expect(decodeMbedtlsBase64(' AQID')).toBeUndefined();
    expect(decodeMbedtlsBase64('AQ\rID')).toBeUndefined();
  });
});
