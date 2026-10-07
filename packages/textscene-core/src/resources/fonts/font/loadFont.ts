/**
 * The Font slice's loaders, the entry points `processors/createFontProcessor.ts` calls: one
 * for a raw container's bytes, one for the section a path addresses in a parsed `.tres`. The
 * decode stays pure over a property bag.
 */

import type { FileData } from '../../FileEventBus';
import { fontResourceFromBytes } from '../../formats/dynamicfont/fontBytes';
import type { LoadedSection } from '../../resourceSection';
import { resourceFilePath } from '../../subResourcePath';
import { decodeFont } from './decode';
import type { FontFileResource, FontLoaderFn, FontResource } from './types';

/**
 * The `FontResource` that `section`, loaded from `path`, decodes to. A scene's own inline
 * Font never comes here: `resolveInlineFontResource` resolves it synchronously, never
 * through the resource event bus.
 */
export async function buildFontResource(
  path: string,
  { file, type, properties }: LoadedSection,
  loadFont: FontLoaderFn
): Promise<FontResource> {
  return decodeFont(resourceFilePath(path), type, properties, file.extResources, file.subResources, loadFont);
}

/** A raw font container's bytes. Text at a container path is no font, so it throws. */
export function fontResourceFromContainer(path: string, data: FileData): FontFileResource {
  if (typeof data === 'string') throw new Error(`${path} is text, not font bytes`);
  return fontResourceFromBytes(path, data);
}
