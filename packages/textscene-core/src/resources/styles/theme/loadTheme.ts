/**
 * The Theme slice's whole-file loader — the seam between a fetched `.tres` and
 * `decode.ts`, and the one entry point `processors/createThemeProcessor.ts`
 * calls. Mirrors the Font slice's `loadFont.ts` and the StandardMaterial3D
 * slice's `loadMaterial.ts`: whole-file CONTENT (`parseTresFile`) and
 * sub-resource addressing here, a pure property-bag decode next door.
 */

import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import type { FontLoaderFn, FontResource } from '../../fonts/font/types';
import { findSubResource } from '../../SubResourceResolver';
import { parseSubResourcePath } from '../../subResourcePath';
import { decodeThemeAddresses } from './decode';
import type { ThemeAddresses, ThemeResource } from './types';

/**
 * Resolve `ThemeAddresses` into a `ThemeResource` by awaiting `loadFont` for
 * every address — the file-backed path, which already runs inside an async
 * `process()` step. A Theme's font refs resolve through a DIFFERENT processor
 * than its own, so the loader is injected rather than self-referential.
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
    colors: addresses.colors,
    constants: addresses.constants,
    typeVariations: addresses.typeVariations,
    properties: addresses.properties,
    resources: addresses.resources,
  };
}

/**
 * Build a `ThemeResource` from a `.tres`'s text content — either its own
 * `[resource]` body (`subResourceId` absent) or a named `[sub_resource]`
 * inside it. `content` must carry a `[gd_resource]` header (`parseTresFile`'s
 * requirement).
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
    // `parseInternalResource` echoes the heading's own `id` into `data` — strip
    // it back out, or it leaks into `properties` as a fake declared property.
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
 * Unlike a Font, a Theme is ALWAYS `.tres` text — never raw bytes — so there is
 * no ArrayBuffer branch; `shouldProcess` gates on that upstream. `path` is the
 * full requested ADDRESS (may carry a `::SubId`).
 */
export async function buildThemeResource(
  path: string,
  content: string,
  loadFont: FontLoaderFn
): Promise<ThemeResource> {
  const { filePath, subResourceId } = parseSubResourcePath(path);
  return createThemeResourceFromContent(filePath, content, loadFont, subResourceId);
}
