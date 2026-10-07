/**
 * The Theme slice's loader, between a parsed `.tres` and `decode.ts`, called by
 * `processors/createThemeProcessor.ts`. It resolves the decoded font addresses.
 */

import type { FontLoaderFn, FontResource } from '../../fonts/font/types';
import type { LoadedSection } from '../../resourceSection';
import { resourceFilePath } from '../../subResourcePath';
import { decodeThemeAddresses } from './decode';
import type { ThemeAddresses, ThemeResource } from './types';

/**
 * Resolves `ThemeAddresses` into a `ThemeResource` by awaiting `loadFont` for each
 * address, inside the Theme processor's async `loadDirectly`. Font refs resolve
 * through another processor, so the loader is injected.
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

/** The `ThemeResource` that `section`, loaded from `path`, decodes to. */
export async function buildThemeResource(
  path: string,
  { file, properties }: LoadedSection,
  loadFont: FontLoaderFn
): Promise<ThemeResource> {
  const addresses = decodeThemeAddresses(
    resourceFilePath(path),
    properties,
    file.extResources,
    file.subResources
  );
  return resolveThemeResource(addresses, loadFont);
}
