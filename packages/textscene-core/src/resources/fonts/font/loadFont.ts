/**
 * The Font slice's whole-file loader, the one entry point `processors/createFontProcessor.ts`
 * calls. It parses content (`parseTresFile`) and resolves addresses and arrival shapes,
 * so the decode stays pure over a property bag, as with `loadMaterial.ts`.
 */

import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import { fontResourceFromBytes, isFontContainerPath } from '../../formats/dynamicfont/fontBytes';
import { findSubResource } from '../../SubResourceResolver';
import { parseSubResourcePath } from '../../subResourcePath';
import { decodeFont, FONT_SUB_RESOURCE_TYPES } from './decode';
import type { FontLoaderFn, FontResource } from './types';

/**
 * Build a `FontResource` from a `.tres`'s text: its `[resource]` body, or a named
 * `[sub_resource]` when `subResourceId` is set. `content` must carry a `[gd_resource]`
 * header. A scene's own inline Font never comes here: `resolveInlineFontResource`
 * resolves it synchronously, never through the resource event bus.
 */
export async function createFontResourceFromContent(
  filePath: string,
  content: string,
  loadFont: FontLoaderFn,
  subResourceId?: string
): Promise<FontResource> {
  const parsed: ParsedResource = parseTresFile(content);

  let resourceType: string;
  let properties: Record<string, string>;

  if (subResourceId !== undefined) {
    const sub = findSubResource(parsed.subResources, subResourceId);
    if (!sub) {
      throw new Error(`Sub-resource "${subResourceId}" is not declared in ${filePath}`);
    }
    resourceType = sub.type;
    // `parseInternalResource` echoes the heading's own `id` into `data` for
    // `findSubResource`. Strip it, or it leaks into `properties` as a property no
    // Godot file wrote.
    const { id: _id, ...rest } = sub.data as Record<string, string>;
    properties = rest;
  } else {
    resourceType = parsed.resourceType;
    properties = parsed.properties;
  }

  if (!FONT_SUB_RESOURCE_TYPES.has(resourceType)) {
    throw new Error(`Not a font resource type: ${resourceType} (${filePath})`);
  }

  return decodeFont(filePath, resourceType, properties, parsed.extResources, parsed.subResources, loadFont);
}

/**
 * Routes on the fetched shape, raw bytes or text. `path` is the full address, which
 * may carry a `::SubId`. `createFontProcessor` sends every address here unfiltered, so
 * no branch may leave one pending: text that is not a `.tres` fails the `[gd_resource]`
 * header check in `createFontResourceFromContent`.
 */
export async function buildFontResource(
  path: string,
  data: ArrayBuffer | string,
  loadFont: FontLoaderFn
): Promise<FontResource> {
  if (data instanceof ArrayBuffer) {
    if (!isFontContainerPath(path)) {
      // Raw bytes have no parse to validate them, so a non-font path throws. A
      // `::SubId` suffix breaks the extension match too, as a raw font has no
      // sub-resources.
      throw new Error(`Not a recognised font file extension: ${path}`);
    }
    return fontResourceFromBytes(path, data);
  }
  const { filePath, subResourceId } = parseSubResourcePath(path);
  return createFontResourceFromContent(filePath, data, loadFont, subResourceId);
}
