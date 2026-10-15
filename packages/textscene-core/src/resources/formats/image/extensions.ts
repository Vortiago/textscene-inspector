/** The image formats a project file or a glTF URI names: their extensions and MIME types. */

import { fileExtension } from '../../fileExtension';

/** The image formats the browser's decoder reads, dotted: the image slice's claim and the texture processor's gate. */
export const IMAGE_EXTENSIONS: readonly string[] = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

export const SVG_MIME_TYPE = 'image/svg+xml';

/**
 * The MIME type of each image format a project file or a glTF URI names, by dotted extension. KTX2
 * is not in {@link IMAGE_EXTENSIONS}: only a glTF names it, through `KHR_texture_basisu`.
 */
const IMAGE_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', SVG_MIME_TYPE],
  ['.ktx2', 'image/ktx2'],
]);

/** The MIME type of the image `path` names by its extension, or undefined for no image format. */
export function imageMimeType(path: string): string | undefined {
  const extension = fileExtension(path);
  return extension === null ? undefined : IMAGE_MIME_TYPES.get(extension);
}
