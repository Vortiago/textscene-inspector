/**
 * The slice's registration claims (ADR-0031). Importing `index.ts` is what
 * registers them, so this file both exercises the side effect and pins what
 * routing will look up.
 */

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bareSpecifiers,
  FRAMEWORK_BARE_RE,
  tsxFiles,
  walkImportClosure,
} from '@textscene/dev-kit';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

const here = dirname(fileURLToPath(import.meta.url));

describe('standardmaterial3d slice registration', () => {
  it('claims StandardMaterial3D on the material bus', () => {
    const registration = resourceSliceRegistry.byTypeName('StandardMaterial3D');
    expect(registration).not.toBeNull();
    expect(registration).toMatchObject({
      slice: 'standardmaterial3d',
      kind: 'godot-text',
      busType: 'material',
      failureLabel: 'Node using material',
    });
    expect(registration!.typeNames).toContain('StandardMaterial3D');
  });

  it('claims ShaderMaterial too, so it reaches the uncompiled-shader fallback', () => {
    // ADR-0041: no GLSL compilation, so a shader draws Godot's default surface.
    // Without the claim, routing would find no slice and a shipped window-glass
    // shader would sit in the missing-resources panel forever.
    expect(resourceSliceRegistry.byTypeName('ShaderMaterial')?.slice).toBe(
      'standardmaterial3d'
    );
  });

  it('routes both claimed types to the material bus', () => {
    expect(resourceSliceRegistry.busTypeFor('StandardMaterial3D')).toBe('material');
    expect(resourceSliceRegistry.busTypeFor('ShaderMaterial')).toBe('material');
  });

  it('claims no file extension', () => {
    // `.tres` is Godot's one text-resource container and several slices read it,
    // so claiming the extension would hand every TileSet and MeshLibrary to
    // this slice. Its files are recognised by their `[gd_resource type=…]`.
    expect(resourceSliceRegistry.byTypeName('StandardMaterial3D')!.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byExtension('.tres')?.slice).not.toBe('standardmaterial3d');
  });

  it('reaches no renderer, so a claim reader pulls in no bundle', () => {
    // The reason `decode.ts` stops at Godot's own enums and `scalars.ts` /
    // `build.ts` hold every three constant. `walkImportClosure` skips erased
    // imports, so the type-only `import type * as THREE` in `types.ts` is free —
    // this asserts it, rather than assuming erasure.
    const closure = walkImportClosure(resolve(here, 'index.ts'));
    expect(tsxFiles(closure)).toEqual([]);
    expect(
      bareSpecifiers(closure).filter((spec) => FRAMEWORK_BARE_RE.some((re) => re.test(spec)))
    ).toEqual([]);
  });

  it('does not claim a material type it cannot build', () => {
    // ORMMaterial3D is a real Godot type this slice does not decode; claiming it
    // would route a file the loader then refuses.
    expect(resourceSliceRegistry.byTypeName('ORMMaterial3D')?.slice).not.toBe(
      'standardmaterial3d'
    );
  });
});
