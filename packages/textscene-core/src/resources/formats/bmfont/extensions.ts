/** The files Godot's BMFont importer reads (`editor/import/resource_importer_bmfont.cpp:46-47`). */

import { fileExtension } from '../../fileExtension';

/** Dot-prefixed and lowercase, as an extension claim compares them. */
export const BMFONT_EXTENSIONS = ['.fnt', '.font'] as const;

/** A BMFont descriptor, text or binary: the format is read from the bytes, not from the name. */
export function isBmfontPath(path: string): boolean {
  const extension = fileExtension(path);
  return extension !== null && (BMFONT_EXTENSIONS as readonly string[]).includes(extension);
}
