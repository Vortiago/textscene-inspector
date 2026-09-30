/**
 * The required glTF extensions Godot refuses in each file a scene uses, read through a host's provider and kept per
 * provider under the file's stamp ({@link StampedReads}), so an unchanged file is read once, not on every lint.
 */

import type { TscnExternalResource } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { readGltfRequiredExtensions, unsupportedRequiredGltfExtensions } from '../godot/index.js';
import { StampedReads, loadOrNull } from './stampedReads.js';

/**
 * The required extensions of `resource`'s file that Godot refuses. Empty for a file the provider does not hold or
 * cannot read, and for JSON Godot cannot parse: those are the missing-resource path, not this rule's claim.
 */
async function readRefused(provider: ResourceProvider, resource: TscnExternalResource): Promise<string[]> {
  const data = await loadOrNull(provider, resource.path, resource.type);
  if (data === null) return [];
  return unsupportedRequiredGltfExtensions(readGltfRequiredExtensions(data));
}

export class GltfVerdicts {
  private readonly verdicts = new StampedReads<readonly string[]>();

  /** The refused extensions of `resource`'s file. */
  refused(provider: ResourceProvider, resource: TscnExternalResource): Promise<readonly string[]> {
    return this.verdicts.get(provider, resource.path, () => readRefused(provider, resource));
  }
}
