import { describe, expect, it, vi } from 'vitest';
import { fontFile, systemFont } from '../../r3f/controls/native/text/sfntOutlines.testkit';
import { NO_RESOURCES } from '../../r3f/SceneResourcesContext';
import type { ResolvableResource, ScopedResource } from '../scopedResource';
import { NO_FILES, NO_FONTS } from '../testing/loadedFiles';
import { NO_PROJECT_FONTS } from '../fonts/font/projectFonts';
import { undrawnMeshType } from './meshSource';
import { FONT_PATH, readyTextMesh, textMeshWith } from './textmesh/textMeshFont.testkit';

// happy-dom loads no font file, so each loads as the stand-in face.
vi.mock(
  '../../r3f/controls/native/text/sceneFontLoad',
  () => import('../../r3f/controls/native/testing/sceneFontLoadStub')
);

function scopedOf(type: string): ScopedResource {
  return { resource: { id: 'mesh', type, data: {} }, resources: NO_RESOURCES };
}

function resolvedOf(type: string): ResolvableResource {
  return {
    ...scopedOf(type),
    loadedFile: NO_FILES,
    loadedFont: NO_FONTS,
    projectFonts: NO_PROJECT_FONTS,
    locale: '',
  };
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

  it('names a TextMesh whose font is one the previewer cannot read', () => {
    const mesh = textMeshWith({}, { [FONT_PATH]: fontFile(undefined) });

    expect(undrawnMeshType(mesh, mesh)).toBe('TextMesh');
  });

  it('is null for a TextMesh with a SystemFont, which draws the default font', () => {
    const mesh = textMeshWith({}, { [FONT_PATH]: systemFont() });

    expect(undrawnMeshType(mesh, mesh)).toBeNull();
  });

  it('is null for a TextMesh whose font is ready', async () => {
    const mesh = await readyTextMesh();

    expect(undrawnMeshType(mesh, mesh)).toBeNull();
  });
});
