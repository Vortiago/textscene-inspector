/** The slices an Import sidecar cuts a 3D texture's image into (`resource_importer_layered_texture.cpp`). */
import { describe, expect, it } from 'vitest';
import { parseImportFile } from '../../../parser/importParser';
import { importSlicesOf } from './importSlices';

function sidecar(importer: string, params: string) {
  return parseImportFile(`[remap]\n\nimporter="${importer}"\n\n[params]\n\n${params}\n`);
}

describe('importSlicesOf', () => {
  it('reads the slices across and down a 3D texture sidecar', () => {
    expect(importSlicesOf(sidecar('3d_texture', 'slices/horizontal=4\nslices/vertical=2'))).toEqual({
      horizontal: 4,
      vertical: 2,
    });
  });

  it("takes the importer's 8 for a count the sidecar leaves out", () => {
    expect(importSlicesOf(sidecar('3d_texture', 'compress/mode=0'))).toEqual({ horizontal: 8, vertical: 8 });
  });

  it('imports no 3D texture without a sidecar, or under another importer', () => {
    expect(importSlicesOf(null)).toBeNull();
    expect(importSlicesOf(sidecar('texture', 'slices/horizontal=4'))).toBeNull();
  });

  it('imports nothing for a count of 0, which Godot divides by (edge case)', () => {
    expect(importSlicesOf(sidecar('3d_texture', 'slices/horizontal=0'))).toBeNull();
  });
});
