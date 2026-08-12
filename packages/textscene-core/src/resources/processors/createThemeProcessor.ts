/**
 * Factory for the Theme resource processor — sixth peer of texture / material /
 * GLB / scene / font, over the SAME `createResourceProcessor` cache/inflight/
 * event loop. Closest in shape to the material processor: both fetch through
 * `FileEventBus`, both address a **Sub-resource path**
 * (`res://file.tres::SubId`), and both need to load OTHER resources — a
 * material loads its textures, a Theme loads its fonts.
 *
 * Unlike the font processor, a Theme's font dependencies are resolved through
 * a DIFFERENT processor (`loader.fonts`), not itself — so `loadFont` is
 * injected by the caller (`ResourceLoader`) rather than closed over a
 * self-reference the way `createFontProcessor` does.
 *
 * `shouldProcess` only accepts STRING data — unlike a Font, a Theme is never
 * raw bytes (no `.theme`-as-binary corpus shape; `.tres`/`.res`/`.theme` are
 * all text). This is a narrower gate than the font processor's (which must
 * accept both shapes because a Font legitimately can be either), so an
 * ArrayBuffer requested by mistake declines here and falls to whichever
 * OTHER processor's `shouldProcess` claims it, rather than being asked to
 * parse binary as text.
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
    shouldProcess: (_path: string, data: FileData) => typeof data === 'string',
    addressesSubResources: true,
    process: (path, data) => buildThemeResource(path, data as string, loadFont),
  });
}
