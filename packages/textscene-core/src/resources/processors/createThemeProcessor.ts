/**
 * The Theme resource processor, on the shared `createResourceProcessor` loop. It reads
 * the owning file's cached parse, addresses a **Sub-resource path**
 * (`res://file.tres::SubId`) and loads its fonts through the font processor.
 */

import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { ParsedFileLoaderFn } from '../resourceSection';
import { buildThemeResource } from '../styles/theme/loadTheme';
import type { ThemeResource } from '../styles/theme/types';
import type { FontLoaderFn } from '../fonts/font/types';

export function createThemeProcessor(
  eventBus: ResourceEventBus,
  loadParsedFile: ParsedFileLoaderFn,
  /** The font loader for the Theme at `themeKey`, so each font it reads is recorded against it. */
  loadFontFor: (themeKey: string) => FontLoaderFn
): ResourceProcessor<ThemeResource> {
  return createResourceProcessor<ThemeResource>({
    eventBus,
    resourceType: 'theme',
    addressesSubResources: true,
    // Fonts load through a different processor (`loader.fonts`), so `ResourceLoader`
    // injects the loader rather than this closing over itself as `createFontProcessor` does.
    loadDirectly: async (path) => buildThemeResource(path, await loadParsedFile(path), loadFontFor(path)),
  });
}
