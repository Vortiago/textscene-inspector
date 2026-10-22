/**
 * A resource with the tables its references resolve in, and the files an ExtResource loads from.
 * Plain data and a lookup, so a builder reads a reference without a hook: the hook layer loads each
 * file a builder reads, and the builder gets the answer through {@link LoadedFile}.
 */

import type { ParsedResource } from '../parser/parsedResource';
import type { TscnInternalResource } from '../parser/types';
import type { SceneResources } from '../r3f/SceneResourcesContext';

export interface ScopedResource {
  resource: TscnInternalResource;
  /** The pools the resource's own references resolve against. */
  resources: SceneResources;
}

/** The parse of a loaded file, or undefined while it loads and after it failed. */
export type LoadedFile = (path: string) => ParsedResource | undefined;

/** A {@link ScopedResource} that also holds the lookup its ExtResource references resolve through. */
export interface ResolvableResource extends ScopedResource {
  loadedFile: LoadedFile;
}
