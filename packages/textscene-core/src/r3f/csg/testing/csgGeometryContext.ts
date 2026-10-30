/** A `CsgGeometryContext` for a builder test: given tables, files and fonts, and nothing else. */
import type { ParsedResource } from '../../../parser/parsedResource';
import { NO_PROJECT_FONTS, type ProjectFonts } from '../../../resources/fonts/font/projectFonts';
import type { FontResource } from '../../../resources/fonts/font/types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { CsgGeometryContext } from '../csgRegistration';

export function csgGeometryContext({
  internalResources = [],
  externalResources = [],
  files = {},
  fonts = {},
  projectFonts = NO_PROJECT_FONTS,
}: {
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
  files?: Readonly<Record<string, ParsedResource>>;
  fonts?: Readonly<Record<string, FontResource>>;
  projectFonts?: ProjectFonts;
} = {}): CsgGeometryContext {
  return {
    internalResources,
    externalResources,
    loadedFile: (path) => files[path],
    loadedFont: (path) => fonts[path],
    projectFonts,
  };
}
