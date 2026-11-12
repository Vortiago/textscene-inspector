/**
 * What a host answers when asked for the entries of one `res://` folder, and the answers a Control reads while it
 * draws: a folder's entries, or the fact that no such folder exists.
 */
import type { DirectoryEntry } from './projectListing.js';

export type { DirectoryEntry };

/** A folder that was listed, or one the host says does not exist. */
export type DirectoryListing =
  { readonly kind: 'listed'; readonly entries: readonly DirectoryEntry[] } | { readonly kind: 'missing' };

/**
 * The listings a draw reads, by `res://` folder. A folder with no entry, or a null one, has no answer yet or no host that can
 * list: a reader then takes the folder as existing and empty.
 */
export type DirectoryListings = Readonly<Record<string, DirectoryListing | null | undefined>>;

/** The key of a folder in {@link DirectoryListings}: `res://` for the root, else the folder without a trailing slash. */
export function listingKey(resFolder: string): string {
  return resFolder.length > 'res://'.length ? resFolder.replace(/\/+$/, '') : resFolder;
}

/** The `res://` folders that hold `resPath`, nearest first: a change to the file edits each of their listings. */
export function foldersAbove(resPath: string): string[] {
  if (!resPath.startsWith('res://')) return [];
  const parts = resPath.slice('res://'.length).split('/');
  const folders: string[] = [];
  for (let depth = parts.length - 1; depth > 0; depth--)
    folders.push(`res://${parts.slice(0, depth).join('/')}`);
  return [...folders, 'res://'];
}
