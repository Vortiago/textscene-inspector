/**
 * The `_surfaces` field readers: the AABB and Vector4 tuples and the base64 byte payloads,
 * each found through `dictCallField`, and the surface name.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { readAabb, readName, readPackedBytes, readUvScale } from './surfaceFields';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('readAabb', () => {
  it('reads the position and size Godot writes', () => {
    expect(readAabb('{ "aabb": AABB(-1, -1, 1, 2, 2, 1e-05), "format": 1 }')).toEqual({
      position: [-1, -1, 1],
      size: [2, 2, 1e-5],
    });
  });

  it('reads the padded form the tokenizer also loads', () => {
    // get_token discards any character <= 32 before a token (variant_parser.cpp:415-417).
    expect(readAabb('{ "aabb" : AABB ( 0, 0, 0, 1, 1, 1 ) }')).toEqual({
      position: [0, 0, 0],
      size: [1, 1, 1],
    });
  });

  it('is undefined for a short, non-finite or absent aabb', () => {
    expect(readAabb('{ "aabb": AABB(0, 0, 0, 1, 1) }')).toBeUndefined();
    expect(readAabb('{ "aabb": AABB(0, 0, 0, 1, 1, inf) }')).toBeUndefined();
    expect(readAabb('{ "format": 1 }')).toBeUndefined();
  });
});

describe('readUvScale', () => {
  it('reads the x and y of the Vector4', () => {
    expect(readUvScale('{ "uv_scale": Vector4(8, 4, 0, 0) }')).toEqual([8, 4]);
  });

  it('is undefined for another type under the key', () => {
    expect(readUvScale('{ "uv_scale": Vector2(8, 4) }')).toBeUndefined();
  });

  it('keeps a zero scale, which means the stored value is the UV', () => {
    expect(readUvScale('{ "uv_scale": Vector4(0, 0, 0, 0) }')).toEqual([0, 0]);
  });
});

describe('readPackedBytes', () => {
  it('decodes the base64 payload of the named key', () => {
    const block = '{ "vertex_data": PackedByteArray("AQID"), "index_data": PackedByteArray("BA==") }';
    expect(Array.from(readPackedBytes(block, 'vertex_data'))).toEqual([1, 2, 3]);
    expect(Array.from(readPackedBytes(block, 'index_data'))).toEqual([4]);
  });

  it('reads the padded form the tokenizer also loads', () => {
    expect(Array.from(readPackedBytes('{ "vertex_data" : PackedByteArray ( "AQID" ) }', 'vertex_data'))).toEqual([
      1, 2, 3,
    ]);
  });

  it('gives an empty buffer and a warning for a corrupt payload', () => {
    expect(readPackedBytes('{ "vertex_data": PackedByteArray("!!!") }', 'vertex_data')).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('vertex_data is not valid base64'));
  });

  it('gives an empty buffer for an absent key, an empty array or the compat byte list', () => {
    // The writer emits `PackedByteArray()` for an empty array and a comma list only in compat
    // mode (variant_parser.cpp:2398-2415), neither of which carries a quoted payload.
    expect(readPackedBytes('{ "format": 1 }', 'vertex_data')).toHaveLength(0);
    expect(readPackedBytes('{ "vertex_data": PackedByteArray() }', 'vertex_data')).toHaveLength(0);
    expect(readPackedBytes('{ "vertex_data": PackedByteArray(1, 2, 3) }', 'vertex_data')).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('readName', () => {
  it('reads the name Godot writes', () => {
    expect(readName('{ "format": 1, "name": "Body" }')).toBe('Body');
  });

  it('runs past an escaped quote and decodes it', () => {
    expect(readName('{ "name": "say \\"hi\\"", "format": 1 }')).toBe('say "hi"');
  });

  it('is undefined for a surface with no name', () => {
    expect(readName('{ "format": 1 }')).toBeUndefined();
  });

  it('reads a hand-written StringName as its text, as the String slot converts it', () => {
    expect(readName('{ "format": 1, "name": &"Body" }')).toBe('Body');
  });
});
