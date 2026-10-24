/** A TextMesh in a scene that holds a TrueType font, for the tests of what reads its font. */

import { vi } from 'vitest';
import { fixtureFontBytes } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { NO_RESOURCES } from '../../../r3f/SceneResourcesContext';
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

/** A TextMesh whose `font` names `FONT_PATH`, and the fonts loaded so far, `fonts`. */
export function textMeshWith(
  data: Record<string, string> = {},
  fonts: Record<string, FontResource> = {}
): ResolvableResource {
  return {
    resource: { id: 'text', type: 'TextMesh', data: { text: '"H"', font: 'ExtResource("font")', ...data } },
    resources: { ...NO_RESOURCES, externalResources: [{ id: 'font', type: 'FontFile', path: FONT_PATH }] },
    loadedFile: NO_FILES,
    loadedFont: loadedFilesOf(fonts),
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
