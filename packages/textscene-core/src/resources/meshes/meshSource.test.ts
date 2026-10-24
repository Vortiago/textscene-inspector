import { describe, expect, it } from 'vitest';
import { NO_RESOURCES } from '../../r3f/SceneResourcesContext';
import type { ResolvableResource, ScopedResource } from '../scopedResource';
import { NO_FILES, NO_FONTS } from '../testing/loadedFiles';
import { undrawnMeshType } from './meshSource';
import { readyTextMesh, textMeshWith } from './textmesh/textMeshFont.testkit';

function scopedOf(type: string): ScopedResource {
  return { resource: { id: 'mesh', type, data: {} }, resources: NO_RESOURCES };
}

function resolvedOf(type: string): ResolvableResource {
  return { ...scopedOf(type), loadedFile: NO_FILES, loadedFont: NO_FONTS };
}

describe('undrawnMeshType', () => {
  it('names a type no slice builds, resolved or not', () => {
    expect(undrawnMeshType(scopedOf('FutureMesh'), null)).toBe('FutureMesh');
    expect(undrawnMeshType(scopedOf('FutureMesh'), resolvedOf('FutureMesh'))).toBe('FutureMesh');
  });

  it('is null while a primitive mesh loads', () => {
    expect(undrawnMeshType(scopedOf('BoxMesh'), null)).toBeNull();
  });

  it('is null for a primitive mesh that draws', () => {
    expect(undrawnMeshType(scopedOf('BoxMesh'), resolvedOf('BoxMesh'))).toBeNull();
  });

  it('names a TextMesh whose font is not loaded', () => {
    const mesh = textMeshWith();

    expect(undrawnMeshType(mesh, mesh)).toBe('TextMesh');
  });

  it('is null for a TextMesh whose font is ready', async () => {
    const mesh = await readyTextMesh();

    expect(undrawnMeshType(mesh, mesh)).toBeNull();
  });
});
