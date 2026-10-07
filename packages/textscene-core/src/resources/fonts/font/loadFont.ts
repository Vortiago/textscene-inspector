/**
 * The Font slice's loaders, the entry points `processors/createFontProcessor.ts` calls: one
 * for a raw container's bytes, one for the section a path addresses in a parsed `.tres`. The
 * decode stays pure over a property bag.
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { FileData } from '../../FileEventBus';
import { fontResourceFromBytes } from '../../formats/dynamicfont/fontBytes';
import { resourceSectionOfType } from '../../resourceSection';
import { resourceFilePath } from '../../subResourcePath';
import { decodeFont, FONT_SUB_RESOURCE_TYPES } from './decode';
import type { FontFileResource, FontLoaderFn, FontResource } from './types';

/**
 * The `FontResource` that `path` addresses inside `file`: its `[resource]` body, or the
 * `[sub_resource]` a **Sub-resource path** names. A scene's own inline Font never comes
 * here: `resolveInlineFontResource` resolves it synchronously, never through the resource
 * event bus.
 */
export async function buildFontResource(
  path: string,
  file: ParsedResource,
  loadFont: FontLoaderFn
): Promise<FontResource> {
  const { type, properties } = resourceSectionOfType(file, path, FONT_SUB_RESOURCE_TYPES);
  return decodeFont(resourceFilePath(path), type, properties, file.extResources, file.subResources, loadFont);
}

/** A raw font container's bytes. Text at a container path is no font, so it throws. */
export function fontResourceFromContainer(path: string, data: FileData): FontFileResource {
  if (typeof data === 'string') throw new Error(`${path} is text, not font bytes`);
  return fontResourceFromBytes(path, data);
}
