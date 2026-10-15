/**
 * The vendor scripts' prune policy: editor artefacts and source art go, and an import sidecar
 * stays only when the previewer reads it (ADR-0028).
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPruned } from './vendor-prune.mjs';

const root = mkdtempSync(join(tmpdir(), 'vendor-prune-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Writes `name` and its sidecar of `importer` into the scratch folder, and returns the sidecar. */
function sidecarOf(name, bytes, importer) {
  writeFileSync(join(root, name), bytes);
  const sidecar = join(root, `${name}.import`);
  writeFileSync(sidecar, `[remap]\n\nimporter="${importer}"\n\n[params]\n\ncompress/mode=0\n`);
  return sidecar;
}

describe('isPruned', () => {
  it('prunes the editor folders and source art', () => {
    expect(
      ['.godot', 'screenshots', 'art.psd', 'scene.blend'].map((name) => isPruned(join(root, name)))
    ).toEqual([true, true, true, true]);
  });

  it('keeps a scene sidecar, which the asset re-import reads', () => {
    expect(isPruned(sidecarOf('tree.gltf', '{}', 'scene'))).toBe(false);
  });

  it('keeps a 3D texture sidecar, which names the slices', () => {
    expect(isPruned(sidecarOf('fog.png', 'PNG', '3d_texture'))).toBe(false);
  });

  it('keeps a texture sidecar, which decides the import format and the mip chain', () => {
    expect(isPruned(sidecarOf('albedo.png', 'PNG', 'texture'))).toBe(false);
  });

  it('prunes an audio sidecar', () => {
    expect(isPruned(sidecarOf('beep.wav', 'RIFF', 'wav'))).toBe(true);
  });

  it('prunes a scene sidecar whose asset the prune drops', () => {
    expect(isPruned(sidecarOf('tree.blend', 'BLENDER', 'scene'))).toBe(true);
  });

  it('prunes a sidecar whose asset is missing (edge case)', () => {
    const orphan = join(root, 'gone.png.import');
    writeFileSync(orphan, '[remap]\n\nimporter="texture"\n');
    expect(isPruned(orphan)).toBe(true);
  });
});
