/** CSGMesh3D's brush for a TextMesh: it builds from the font once the font file and its metrics have loaded. */

import { describe, expect, it, vi } from 'vitest';
import { parseTresFile, type ParsedResource } from '../../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../../parser/types';
import type { CsgGeometryContext } from '../../../../r3f/csg/csgRegistration';
import { enclosedVolume } from '../../../../r3f/csg/testing/brushVolume';
import { csgGeometryContext } from '../../../../r3f/csg/testing/csgGeometryContext';
import type { FontFileResource } from '../../../../resources/fonts/font/types';
import { distinctAttributePositions } from '../../../../resources/meshes/textmesh/distinctPositions.testkit';
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
const DEEP_H: TscnInternalResource = {
  id: 'DeepH',
  type: 'TextMesh',
  data: { text: '"H"', font: 'ExtResource("font")', font_size: '64', depth: '0.05' },
};
const NO_FONT: TscnInternalResource = { id: 'Plain', type: 'TextMesh', data: { text: '"H"' } };
const FONT_REFERENCE: TscnExternalResource = { id: 'font', type: 'FontFile', path: FONT_PATH };
const PROPERTIES = { mesh: 'SubResource("Text")', flipFaces: false };

const TEXT_FILE_PATH = 'res://text.tres';
/** A `.tres` TextMesh whose font is the file's own ExtResource. */
const TEXT_FILE = parseTresFile(
  `[gd_resource type="TextMesh" format=3]\n\n` +
    `[ext_resource type="FontFile" path="${FONT_PATH}" id="1_font"]\n\n[resource]\n` +
    `text = "H"\nfont = ExtResource("1_font")\n`
);

const contextWith = (font?: FontFileResource): CsgGeometryContext =>
  csgGeometryContext({
    internalResources: [TEXT, DEEP_H, NO_FONT],
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

describe('csgMesh3DGeometry for a TextMesh with depth', () => {
  const DEEP_PROPERTIES = { mesh: 'SubResource("DeepH")', flipFaces: false };
  const brush = async (properties: typeof DEEP_PROPERTIES) =>
    csgMesh3DGeometry(properties, await readyContext())!.geometry;
  // The H outline of this font encloses 818.158 px² at 64 px (fontTools). A pixel is 0.01 and the depth 0.05.
  const OUTLINE_VOLUME = 818.158 * 0.01 ** 2 * 0.05;

  // Godot's CSG builds an "H" at font_size 64 and depth 0.05 from 44 triangles on 24 distinct
  // positions (measured in Godot 4.6.3). Godot hints the glyph to 45 px, so its y extent and its
  // volume are 2.4% under this port's unhinted outline.
  it('reaches the brush with the triangles and the positions Godot builds', async () => {
    const positions = (await brush(DEEP_PROPERTIES)).getAttribute('position');

    expect(positions.count / 3).toBe(44);
    expect(distinctAttributePositions(positions)).toHaveLength(24);
  });

  it('spans the x and z extent Godot builds', async () => {
    const geometry = await brush(DEEP_PROPERTIES);
    geometry.computeBoundingBox();

    expect(geometry.boundingBox!.min.x).toBeCloseTo(-0.18, 6);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(0.180312, 6);
    expect(geometry.boundingBox!.max.z).toBeCloseTo(0.025, 6);
  });

  it('encloses the outline area times the depth, with the faces outward', async () => {
    expect(enclosedVolume(await brush(DEEP_PROPERTIES))).toBeCloseTo(OUTLINE_VOLUME, 7);
  });

  it('winds inward with flip_faces, as Godot does', async () => {
    expect(enclosedVolume(await brush({ ...DEEP_PROPERTIES, flipFaces: true }))).toBeCloseTo(
      -OUTLINE_VOLUME,
      7
    );
  });
});

describe('csgMesh3DUndrawnMeshType for a TextMesh', () => {
  it('names the type for a mesh whose font has no readable outlines', () => {
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
  it('moves when the font file reloads', async () => {
    const first = csgMesh3DGeometryKey(PROPERTIES, await readyContext());

    expect(csgMesh3DGeometryKey(PROPERTIES, await readyContext())).not.toBe(first);
  });

  it('moves when the metrics of the font settle, in a context made afterwards', async () => {
    const awaiting = csgMesh3DGeometryKey(PROPERTIES, contextWith(trueTypeFontFile()));

    expect(csgMesh3DGeometryKey(PROPERTIES, await readyContext())).not.toBe(awaiting);
  });
});

describe('csgMesh3DGeometry for a .tres TextMesh', () => {
  const FILE_PROPERTIES = { mesh: 'ExtResource("text")', flipFaces: false };
  const fileContext = (files: Record<string, ParsedResource>, font?: FontFileResource): CsgGeometryContext =>
    csgGeometryContext({
      externalResources: [{ id: 'text', type: 'TextMesh', path: TEXT_FILE_PATH }],
      files,
      fonts: font ? { [FONT_PATH]: font } : {},
    });

  it('names no font while its file loads, and the font of the file once it has', () => {
    expect(csgMesh3DReadsFonts(FILE_PROPERTIES, fileContext({}))).toEqual([]);
    expect(csgMesh3DReadsFonts(FILE_PROPERTIES, fileContext({ [TEXT_FILE_PATH]: TEXT_FILE }))).toEqual([
      FONT_PATH,
    ]);
  });

  it('builds the glyphs once the file and its font are ready', async () => {
    const ctx = fileContext({ [TEXT_FILE_PATH]: TEXT_FILE }, trueTypeFontFile());
    await vi.waitFor(() => expect(csgMesh3DAwaitsFontMetrics(FILE_PROPERTIES, ctx)).toBe(false));

    expect(csgMesh3DGeometry(FILE_PROPERTIES, ctx)!.geometry.getAttribute('position').count).toBeGreaterThan(
      0
    );
  });
});
