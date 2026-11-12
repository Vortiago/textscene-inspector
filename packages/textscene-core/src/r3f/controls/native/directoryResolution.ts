/**
 * A node settled with the folders its type lists (`DirectoryResolver`): the walk reads each folder from the loader's cache, and
 * a folder not cached yet is handed back to be requested.
 */

import type { TscnNode } from '../../../parser/types';
import type { DirectoryListing, DirectoryListings } from '../../../resources/directoryListing';
import type { DirectoryResolver } from './solverRegistry';

/** One answer can name the next folder, but never a deep chain: a refused line leads to the root once. */
const MAX_ROUNDS = 8;

/** What the loader's cache holds for a folder: undefined before the first request, null when no listing came. */
type ReadListing = (folder: string) => DirectoryListing | null | undefined;

/**
 * `node` with every folder `resolver` asks for read through `read`. A folder not cached is added to `pending`, and reads as
 * unanswered until a later walk finds it cached.
 */
export function settleDirectories(
  node: TscnNode,
  resolver: DirectoryResolver,
  read: ReadListing,
  pending: Set<string>
): TscnNode {
  const listings: Record<string, DirectoryListing | null> = {};
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const unread = resolver.folders(node, listings).filter((folder) => !(folder in listings));
    if (unread.length === 0) break;
    for (const folder of unread) {
      const cached = read(folder);
      if (cached === undefined) pending.add(folder);
      listings[folder] = cached ?? null;
    }
  }
  return resolver.resolve(node, listings as DirectoryListings);
}
