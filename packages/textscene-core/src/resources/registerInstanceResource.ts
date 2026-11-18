import type { TscnExternalResource } from '../parser/types.js';
import type { ResourceLoader } from './ResourceLoader.js';
import { findExtResource, parseResourceReference } from './SubResourceResolver.js';

/** Registers the PackedScene ExtResource `instanceRef` names, which the scene load checks the type of. */
export function registerInstanceResource(
  loader: ResourceLoader,
  instanceRef: string,
  externalResources: readonly TscnExternalResource[]
): void {
  const parsed = parseResourceReference(instanceRef);
  if (parsed?.type !== 'ExtResource') return;
  const ext = findExtResource(externalResources, parsed.id);
  if (ext) loader.register(ext);
}
