/** A `CsgGeometryContext` for a builder test: given tables, files and fonts, and nothing else. */
import type { ParsedResource } from '../../../parser/parsedResource';
import type { FontResource } from '../../../resources/fonts/font/types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { CsgGeometryContext } from '../csgRegistration';

export function csgGeometryContext({
  internalResources = [],
  externalResources = [],
  files = {},
  fonts = {},
}: {
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
  files?: Readonly<Record<string, ParsedResource>>;
  fonts?: Readonly<Record<string, FontResource>>;
} = {}): CsgGeometryContext {
  return {
    internalResources,
    externalResources,
    loadedFile: (path) => files[path],
    loadedFont: (path) => fonts[path],
  };
}
