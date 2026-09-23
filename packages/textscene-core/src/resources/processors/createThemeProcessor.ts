/**
 * The Theme resource processor, on the shared `createResourceProcessor` loop.
 * Like the material processor it fetches through `FileEventBus`, addresses a
 * **Sub-resource path** (`res://file.tres::SubId`) and loads other resources.
 */

import type { FileEventBus, FileData } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { buildThemeResource } from '../styles/theme/loadTheme';
import type { ThemeResource } from '../styles/theme/types';
import type { FontLoaderFn } from '../fonts/font/types';

export function createThemeProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  loadFont: FontLoaderFn
): ResourceProcessor<ThemeResource> {
  return createResourceProcessor<ThemeResource>({
    fileEventBus,
    eventBus,
    resourceType: 'theme',
    // Strings only, unlike a Font: `.tres`/`.res`/`.theme` are all text, so an
    // ArrayBuffer declines here and falls to another processor's `shouldProcess`
    // rather than be parsed as text.
    shouldProcess: (_path: string, data: FileData) => typeof data === 'string',
    addressesSubResources: true,
    // Fonts load through a different processor (`loader.fonts`), so `ResourceLoader`
    // injects `loadFont` rather than this closing over itself as `createFontProcessor` does.
    process: (path, data) => buildThemeResource(path, data as string, loadFont),
  });
}
