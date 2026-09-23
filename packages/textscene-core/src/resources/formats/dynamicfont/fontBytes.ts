/**
 * The raw font container byte layer: extension recognition, mime type, and the wrap of
 * fetched bytes into a `FontFileResource`. The browser's `FontFace` is the parser, and
 * the slice's extension claim in `index.ts` shares this extension list.
 */

import type { FontFileResource } from '../../fonts/font/types';

/**
 * Dot-prefixed and lowercase, as the extension claim and a provider's `fileExtension`
 * compare them. `ttc`, `otc`, `pfb` and `pfm` stay unclaimed, as `FontFace` decodes none,
 * though Godot imports them (`editor/import/resource_importer_dynamic_font.cpp:47-58`).
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

/** A raw binary font file, the shape a `FontFile` `ExtResource` usually takes. */
export function isFontContainerPath(path: string): boolean {
  return (FONT_CONTAINER_EXTENSIONS as readonly string[]).includes(extensionOf(path));
}

export function fontContainerMimeType(path: string): string | undefined {
  return FONT_MIME_TYPES[extensionOf(path)];
}

/** A raw font file's bytes need no parsing: they are the resource. */
export function fontResourceFromBytes(path: string, bytes: ArrayBuffer): FontFileResource {
  return { kind: 'file', bytes, mimeType: fontContainerMimeType(path), fallbacks: [], properties: {} };
}
