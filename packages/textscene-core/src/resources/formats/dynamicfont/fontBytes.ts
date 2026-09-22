/**
 * The raw font container byte layer: extension recognition, mime type, and the
 * one-step wrap of fetched bytes into the Font slice's `FontFileResource`.
 *
 * There is nothing to parse here — the real parser is the browser's own
 * `FontFace`, which the text painter constructs from these bytes
 * (`new FontFace(family, bytes)` + `document.fonts.add`). This module only
 * decides which paths carry such bytes, and that decision is shared with the
 * slice's extension claim in `index.ts` so the two can never drift.
 */

import type { FontFileResource } from '../../fonts/font/types';

/**
 * Dot-prefixed and lowercase — the shape both the extension claim and a
 * provider's `fileExtension` comparison use.
 *
 * Godot's own dynamic-font importer additionally recognises `ttc`, `otc`,
 * `pfb` and `pfm` (`ResourceImporterDynamicFont::get_recognized_extensions`,
 * `editor/import/resource_importer_dynamic_font.cpp:47-58`). They are left
 * unclaimed deliberately: `FontFace` decodes none of them, so claiming one
 * would promise bytes this previewer cannot turn into a drawable face.
 */
export const FONT_CONTAINER_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'] as const;

const FONT_MIME_TYPES: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function extensionOf(path: string): string {
  return `.${path.split('.').pop()?.toLowerCase() ?? ''}`;
}

/** A raw binary font file — the shape a `FontFile` `ExtResource` overwhelmingly takes. */
export function isFontContainerPath(path: string): boolean {
  return (FONT_CONTAINER_EXTENSIONS as readonly string[]).includes(extensionOf(path));
}

export function fontContainerMimeType(path: string): string | undefined {
  return FONT_MIME_TYPES[extensionOf(path)];
}

/** A raw font file's bytes need no parsing — they ARE the resource. */
export function fontResourceFromBytes(path: string, bytes: ArrayBuffer): FontFileResource {
  return { kind: 'file', bytes, mimeType: fontContainerMimeType(path), fallbacks: [], properties: {} };
}
