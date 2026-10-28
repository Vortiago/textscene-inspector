/** A TextMesh in a scene that holds a TrueType or OpenType-CFF font, for the tests of what reads its font. */

import { vi } from 'vitest';
import { woffFromSfnt } from '../../../r3f/controls/native/text/fontContainer.testkit';
import { fixtureFontBytes } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { NO_RESOURCES } from '../../../r3f/SceneResourcesContext';
import { NO_PROJECT_FONTS, type ProjectFonts } from '../../fonts/font/projectFonts';
import type { FontFileResource, FontResource } from '../../fonts/font/types';
import type { ResolvableResource } from '../../scopedResource';
import { NO_FILES, loadedFilesOf } from '../../testing/loadedFiles';
import { textMeshFont } from './textMeshFont';

export const FONT_PATH = 'res://fonts/open-sans.ttf';

/** A FontFile with TrueType outlines, new on each call: the metrics of a font settle once per file. */
export function trueTypeFontFile(): FontFileResource {
  return {
    kind: 'file',
    bytes: fixtureFontBytes('open-sans-semibold-subset.ttf'),
    mimeType: 'font/ttf',
    fallbacks: [],
    properties: {},
  };
}

/** A FontFile with CFF outlines, new on each call. */
export function openTypeFontFile(): FontFileResource {
  return {
    ...trueTypeFontFile(),
    bytes: fixtureFontBytes('montserrat-extra-bold.otf'),
    mimeType: 'font/otf',
  };
}

/** A FontFile in a WOFF, new on each call. */
export function woffFontFile(): FontFileResource {
  return {
    ...trueTypeFontFile(),
    bytes: woffFromSfnt(fixtureFontBytes('open-sans-semibold-subset.ttf'), { compress: true }),
    mimeType: 'font/woff',
  };
}

/** A FontFile in a WOFF2 whose `glyf` is transformed, new on each call. */
export function woff2FontFile(): FontFileResource {
  return {
    ...trueTypeFontFile(),
    bytes: fixtureFontBytes('recursive-vf-subset.woff2'),
    mimeType: 'font/woff2',
  };
}

/** A SystemFont: OS family names, which the previewer has no bytes for. */
export function systemFontResource(): FontResource {
  return { kind: 'system', fontNames: ['sans-serif'], properties: {} };
}

/** A TextMesh whose `font` names `FONT_PATH`, and the fonts loaded so far, `fonts`. */
export function textMeshWith(
  data: Record<string, string> = {},
  fonts: Record<string, FontResource> = {},
  projectFonts: ProjectFonts = NO_PROJECT_FONTS
): ResolvableResource {
  return {
    resource: { id: 'text', type: 'TextMesh', data: { text: '"H"', font: 'ExtResource("font")', ...data } },
    resources: { ...NO_RESOURCES, externalResources: [{ id: 'font', type: 'FontFile', path: FONT_PATH }] },
    loadedFile: NO_FILES,
    loadedFont: loadedFilesOf(fonts),
    projectFonts,
  };
}

/** `textMeshWith` its font loaded, once the metrics of that font have settled. */
export async function readyTextMesh(data: Record<string, string> = {}): Promise<ResolvableResource> {
  const mesh = textMeshWith(data, { [FONT_PATH]: trueTypeFontFile() });
  await vi.waitFor(() => {
    if (textMeshFont(mesh).status !== 'ready') throw new Error('the metrics have not settled');
  });
  return mesh;
}
