/**
 * The Theme slice's whole-file loader, between a fetched `.tres` and `decode.ts`,
 * called by `processors/createThemeProcessor.ts`. It owns `parseTresFile` and
 * sub-resource addressing, like `loadFont.ts` and `loadMaterial.ts`.
 */

import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import type { FontLoaderFn, FontResource } from '../../fonts/font/types';
import { findSubResource } from '../../SubResourceResolver';
import { parseSubResourcePath } from '../../subResourcePath';
import { decodeThemeAddresses } from './decode';
import type { ThemeAddresses, ThemeResource } from './types';

/**
 * Resolves `ThemeAddresses` into a `ThemeResource` by awaiting `loadFont` for each
 * address, inside an async `process()` step. Font refs resolve through another
 * processor, so the loader is injected.
 */
export async function resolveThemeResource(
  addresses: ThemeAddresses,
  loadFont: FontLoaderFn
): Promise<ThemeResource> {
  const resolveFont = async (address: string | null): Promise<FontResource | null> =>
    address ? loadFont(address) : null;

  const defaultFont = await resolveFont(addresses.defaultFont);

  const fonts: Record<string, Record<string, FontResource>> = {};
  await Promise.all(
    Object.entries(addresses.fonts).map(async ([type, byName]) => {
      const resolvedByName: Record<string, FontResource> = {};
      await Promise.all(
        Object.entries(byName).map(async ([name, address]) => {
          const font = await loadFont(address);
          if (font) resolvedByName[name] = font;
        })
      );
      if (Object.keys(resolvedByName).length) fonts[type] = resolvedByName;
    })
  );

  return {
    defaultFont,
    defaultFontSize: addresses.defaultFontSize,
    fonts,
    fontSizes: addresses.fontSizes,
    styles: addresses.styles,
    icons: addresses.icons,
    colors: addresses.colors,
    constants: addresses.constants,
    typeVariations: addresses.typeVariations,
    properties: addresses.properties,
    resources: addresses.resources,
  };
}

/**
 * A `ThemeResource` from a `.tres`'s `[resource]` body, or from a named
 * `[sub_resource]` when `subResourceId` is set. `content` must carry a
 * `[gd_resource]` header (`parseTresFile`'s requirement).
 */
export async function createThemeResourceFromContent(
  filePath: string,
  content: string,
  loadFont: FontLoaderFn,
  subResourceId?: string
): Promise<ThemeResource> {
  const parsed: ParsedResource = parseTresFile(content);

  let properties: Record<string, string>;

  if (subResourceId !== undefined) {
    const sub = findSubResource(parsed.subResources, subResourceId);
    if (!sub) {
      throw new Error(`Sub-resource "${subResourceId}" is not declared in ${filePath}`);
    }
    if (sub.type !== 'Theme') {
      throw new Error(`Not a Theme resource: ${sub.type} (${filePath})`);
    }
    // `parseInternalResource` echoes the heading's `id` into `data`. Strip it, or
    // it leaks into `properties` as a fake declared property.
    const { id: _id, ...rest } = sub.data as Record<string, string>;
    properties = rest;
  } else {
    if (parsed.resourceType !== 'Theme') {
      throw new Error(`Not a Theme resource: ${parsed.resourceType} (${filePath})`);
    }
    properties = parsed.properties;
  }

  const addresses = decodeThemeAddresses(filePath, properties, parsed.extResources, parsed.subResources);
  return resolveThemeResource(addresses, loadFont);
}

/**
 * A Theme is always `.tres` text, so there is no ArrayBuffer branch:
 * `shouldProcess` gates on that upstream. `path` is the full requested address,
 * which may carry a `::SubId`.
 */
export async function buildThemeResource(
  path: string,
  content: string,
  loadFont: FontLoaderFn
): Promise<ThemeResource> {
  const { filePath, subResourceId } = parseSubResourcePath(path);
  return createThemeResourceFromContent(filePath, content, loadFont, subResourceId);
}
