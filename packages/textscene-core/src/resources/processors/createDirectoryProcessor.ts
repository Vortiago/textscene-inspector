/**
 * The directory processor: the entries of one `res://` folder, listed by the host's provider on the 'directory' bus slot.
 * A host that cannot list makes the request fail, which a reader sees as null. A folder the host lacks is a listing of its own
 * kind, since a FileDialog refuses it where it would draw an empty one.
 */

import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import type { DirectoryEntry, DirectoryListing } from '../directoryListing';

export function createDirectoryProcessor(
  eventBus: ResourceEventBus,
  list: (folder: string) => Promise<readonly DirectoryEntry[] | null>
): ResourceProcessor<DirectoryListing> {
  return createResourceProcessor({
    eventBus,
    resourceType: 'directory',
    loadDirectly: async (folder) => {
      const entries = await list(folder);
      return entries === null ? { kind: 'missing' } : { kind: 'listed', entries };
    },
  });
}
