/** A `CsgGeometryContext` for a builder test: given tables and files, and nothing else. */
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { CsgGeometryContext } from '../csgRegistration';

export function csgGeometryContext({
  internalResources = [],
  externalResources = [],
  files = {},
}: {
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
  files?: Readonly<Record<string, ParsedResource>>;
} = {}): CsgGeometryContext {
  return { internalResources, externalResources, file: (path) => files[path] };
}
