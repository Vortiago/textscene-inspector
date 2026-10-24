/** CSGMesh3D's brush for a TextMesh: it builds from the font once the font file and its metrics have loaded. */

import { describe, expect, it, vi } from 'vitest';
import type { TscnExternalResource, TscnInternalResource } from '../../../../parser/types';
import type { CsgGeometryContext } from '../../../../r3f/csg/csgRegistration';
import { csgGeometryContext } from '../../../../r3f/csg/testing/csgGeometryContext';
import type { FontFileResource } from '../../../../resources/fonts/font/types';
import { FONT_PATH, trueTypeFontFile } from '../../../../resources/meshes/textmesh/textMeshFont.testkit';
import {
  csgMesh3DAwaitsFontMetrics,
  csgMesh3DGeometry,
  csgMesh3DGeometryKey,
  csgMesh3DReadsFonts,
  csgMesh3DUndrawnMeshType,
} from './csgGeometry';

const TEXT: TscnInternalResource = {
  id: 'Text',
  type: 'TextMesh',
  data: { text: '"H"', font: 'ExtResource("font")' },
};
const NO_FONT: TscnInternalResource = { id: 'Plain', type: 'TextMesh', data: { text: '"H"' } };
const FONT_REFERENCE: TscnExternalResource = { id: 'font', type: 'FontFile', path: FONT_PATH };
const PROPERTIES = { mesh: 'SubResource("Text")', flipFaces: false };

const contextWith = (font?: FontFileResource): CsgGeometryContext =>
  csgGeometryContext({
    internalResources: [TEXT, NO_FONT],
    externalResources: [FONT_REFERENCE],
    fonts: font ? { [FONT_PATH]: font } : {},
  });

/** A context whose font has loaded and whose metrics have settled. */
async function readyContext(): Promise<CsgGeometryContext> {
  const ctx = contextWith(trueTypeFontFile());
  await vi.waitFor(() => expect(csgMesh3DAwaitsFontMetrics(PROPERTIES, ctx)).toBe(false));
  return ctx;
}

describe('csgMesh3DGeometry for a TextMesh', () => {
  it('builds a brush of the glyphs once the font is ready', async () => {
    const solid = csgMesh3DGeometry(PROPERTIES, await readyContext());

    expect(solid!.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('is not built while the metrics of its font are to settle', () => {
    expect(csgMesh3DGeometry(PROPERTIES, contextWith(trueTypeFontFile()))).toBeNull();
  });

  it('is not built for a TextMesh with no font', () => {
    expect(csgMesh3DGeometry({ ...PROPERTIES, mesh: 'SubResource("Plain")' }, contextWith())).toBeNull();
  });
});

describe('csgMesh3DUndrawnMeshType for a TextMesh', () => {
  it('names the type for a mesh whose font has no TrueType outlines', () => {
    const notAnSfnt = { ...trueTypeFontFile(), bytes: new ArrayBuffer(8) };

    expect(csgMesh3DUndrawnMeshType(PROPERTIES, contextWith(notAnSfnt))).toBe('TextMesh');
  });

  it('names no type for a mesh whose font is ready', async () => {
    expect(csgMesh3DUndrawnMeshType(PROPERTIES, await readyContext())).toBeNull();
  });

  it('names no type for a mesh whose font awaits its metrics', () => {
    expect(csgMesh3DUndrawnMeshType(PROPERTIES, contextWith(trueTypeFontFile()))).toBeNull();
  });
});

describe('csgMesh3DReadsFonts', () => {
  it('names the font file of a TextMesh, loaded or not', () => {
    expect(csgMesh3DReadsFonts(PROPERTIES, contextWith())).toEqual([FONT_PATH]);
    expect(csgMesh3DReadsFonts(PROPERTIES, contextWith(trueTypeFontFile()))).toEqual([FONT_PATH]);
  });

  it('names no file for a mesh that reads no font', () => {
    const ctx = csgGeometryContext({
      internalResources: [{ id: 'Box', type: 'BoxMesh', data: {} }],
    });

    expect(csgMesh3DReadsFonts({ mesh: 'SubResource("Box")' }, ctx)).toEqual([]);
  });
});

describe('csgMesh3DAwaitsFontMetrics', () => {
  it('is true while the metrics of the font are to settle', () => {
    expect(csgMesh3DAwaitsFontMetrics(PROPERTIES, contextWith(trueTypeFontFile()))).toBe(true);
  });

  it('is false for a mesh that reads no font', () => {
    const ctx = csgGeometryContext({ internalResources: [{ id: 'Box', type: 'BoxMesh', data: {} }] });

    expect(csgMesh3DAwaitsFontMetrics({ mesh: 'SubResource("Box")' }, ctx)).toBe(false);
  });

  it('is false for no mesh', () => {
    expect(csgMesh3DAwaitsFontMetrics({ mesh: undefined }, contextWith())).toBe(false);
  });
});

describe('csgMesh3DGeometryKey for a TextMesh', () => {
  it('moves when the metrics of the font settle, in a context made afterwards', async () => {
    const awaiting = csgMesh3DGeometryKey(PROPERTIES, contextWith(trueTypeFontFile()));

    expect(csgMesh3DGeometryKey(PROPERTIES, await readyContext())).not.toBe(awaiting);
  });
});
