/**
 * The kinds of file the loader builds a value for: each has its own cache and its own bus. A
 * reader names a kind to read a file's value, a hook or a snapshot alike. No React.
 */

import type { ParsedResource } from '../parser/parsedResource';
import type { ResourceProcessor } from './createResourceProcessor';
import type { FontResource } from './fonts/font/types';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceType } from './ResourceEventBus';
import type { ThemeResource } from './styles/theme/types';

/** The cache and the bus events of one kind of file. */
export interface FileKind<T extends object> {
  readonly busTypes: readonly ResourceType[];
  readonly cacheOf: (loader: ResourceLoader) => ResourceProcessor<T>;
}

/** A resource file parsed to its sections, on the generic resource bus. */
export const PARSED_RESOURCES: FileKind<ParsedResource> = {
  busTypes: ['resource'],
  cacheOf: (loader) => loader.resources,
};

/** A font file loads on the font bus. */
export const FONT_FILES: FileKind<FontResource> = { busTypes: ['font'], cacheOf: (loader) => loader.fonts };

/** A Theme file loads on the theme bus, with the fonts it names. */
export const THEME_FILES: FileKind<ThemeResource> = {
  busTypes: ['theme'],
  cacheOf: (loader) => loader.themes,
};

/** Every bus a file kind loads on: a reader that may read any kind listens to these. */
export const FILE_KIND_BUSES: readonly ResourceType[] = [PARSED_RESOURCES, FONT_FILES, THEME_FILES].flatMap(
  (kind) => kind.busTypes
);
