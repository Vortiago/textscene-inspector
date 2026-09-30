/**
 * The required glTF extensions Godot refuses in each file a scene uses, read through a host's provider and kept per
 * provider under the file's stamp. A host lints on each debounced edit, so an unchanged file is read once, not on
 * every lint. Only the verdict is kept, never the bytes.
 */

import type { TscnExternalResource } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { readGltfRequiredExtensions, unsupportedRequiredGltfExtensions } from '../godot/index.js';

interface Verdict {
  readonly stamp: string;
  readonly refused: readonly string[];
}

/**
 * The required extensions of `resource`'s file that Godot refuses. Empty for a file the provider does not hold or
 * cannot read, and for JSON Godot cannot parse: those are the missing-resource path, not this rule's claim. A rejection
 * counts as a miss, since the VS Code and web providers throw for a missing file where the contract says null.
 */
async function readRefused(provider: ResourceProvider, resource: TscnExternalResource): Promise<string[]> {
  const data = await provider.loadResource(resource.path, resource.type).catch(() => null);
  if (data === null) return [];
  return unsupportedRequiredGltfExtensions(readGltfRequiredExtensions(data));
}

export class GltfVerdicts {
  /**
   * Each provider's verdicts by `res://` path. Written by `refused` after each read, and a path is dropped when its
   * stamp cannot be read. An entry goes with its provider, which a host drops when the project view changes.
   */
  private readonly byProvider = new WeakMap<ResourceProvider, Map<string, Verdict>>();

  /**
   * The refused extensions of `resource`'s file. The stamp is read before the file, so a file that changes between
   * the two reads is stored under the older stamp, and the next lint reads it again.
   */
  async refused(provider: ResourceProvider, resource: TscnExternalResource): Promise<readonly string[]> {
    // No stamp, no cache: the read starts at once.
    if (!provider.stamp) return readRefused(provider, resource);
    const verdicts = this.verdictsOf(provider);
    // A stamp that cannot be read is no stamp, and the file is read.
    const stamp = await provider.stamp(resource.path).catch(() => null);
    const kept = verdicts.get(resource.path);
    if (stamp !== null && kept?.stamp === stamp) return kept.refused;

    const refused = await readRefused(provider, resource);
    if (stamp === null) verdicts.delete(resource.path);
    else verdicts.set(resource.path, { stamp, refused });
    return refused;
  }

  private verdictsOf(provider: ResourceProvider): Map<string, Verdict> {
    let verdicts = this.byProvider.get(provider);
    if (!verdicts) {
      verdicts = new Map();
      this.byProvider.set(provider, verdicts);
    }
    return verdicts;
  }
}
