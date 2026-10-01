/**
 * The required glTF extensions Godot refuses in each file a scene uses, read through a host's provider and kept per
 * provider under the file's stamp ({@link StampedReads}), so an unchanged file is read once, not on every lint.
 */

import type { TscnExternalResource } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { readGltfRequiredExtensions, unsupportedRequiredGltfExtensions } from '../godot/index.js';
import { StampedReads, loadOrNull } from './stampedReads.js';

/**
 * The required extensions of `resource`'s file that Godot refuses, or null for a file the provider does not hold or
 * cannot read: that is the missing-resource path, not this rule's claim. Empty for JSON Godot cannot parse.
 */
async function readRefused(
  provider: ResourceProvider,
  resource: TscnExternalResource
): Promise<string[] | null> {
  const data = await loadOrNull(provider, resource.path, resource.type);
  return data === null ? null : unsupportedRequiredGltfExtensions(readGltfRequiredExtensions(data));
}

export class GltfVerdicts {
  /** Null, which is never kept, for a file a read could not deliver, so the next lint reads it again. */
  private readonly verdicts = new StampedReads<readonly string[] | null>();

  /** The refused extensions of `resource`'s file, and none for a file the provider could not deliver. */
  async refused(provider: ResourceProvider, resource: TscnExternalResource): Promise<readonly string[]> {
    return (await this.verdicts.get(provider, resource.path, () => readRefused(provider, resource))) ?? [];
  }
}
