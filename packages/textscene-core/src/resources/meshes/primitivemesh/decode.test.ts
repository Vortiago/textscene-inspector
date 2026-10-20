import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodePrimitiveMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodePrimitiveMesh', () => {
  it('falls back to the Godot defaults when everything is absent', () => {
    expect(decodePrimitiveMesh({})).toEqual({ flipFaces: false, addUv2: false, uv2Padding: 2 });
  });

  it('reads every authored field', () => {
    expect(decodePrimitiveMesh({ flip_faces: 'true', add_uv2: 'true', uv2_padding: '0.5' })).toEqual({
      flipFaces: true,
      addUv2: true,
      uv2Padding: 0.5,
    });
  });

  it('warns and keeps the default padding for a malformed value', () => {
    expect(decodePrimitiveMesh({ uv2_padding: 'wide' }).uv2Padding).toBe(2);
    expect(warnSpy).toHaveBeenCalled();
  });
});
