/**
 * The listing of the fixtures mirror, which a static site cannot read from its host: `copy-fixtures.js` writes every folder of
 * `public/fixtures/` with its entries, and a FileDialog lists a `res://` folder from it.
 */

import type { DirectoryEntry } from '@textscene/core/resources/projectListing';

/** Where the site serves the listing, beside the mirror it describes. */
export const FIXTURE_LISTING_URL = '/fixtures-listing.json';

/** Each folder by its path under the mirror (`''` is the mirror itself), holding its entry names, a folder's with a trailing `/`. */
export type FixtureListing = Readonly<Record<string, readonly string[]>>;

/** The entries of the mirror folder `folder`, or null when the mirror holds no such folder. */
export function mirrorEntries(listing: FixtureListing, folder: string): DirectoryEntry[] | null {
  const names = Object.hasOwn(listing, folder) ? listing[folder]! : null;
  if (names === null) return null;
  return names.map((name) =>
    name.endsWith('/') ? { name: name.slice(0, -1), isDirectory: true } : { name, isDirectory: false }
  );
}

/** The mirror folder a `res://` folder is under the corpus root `resourceRoot`. */
export function mirrorFolderOf(resFolder: string, resourceRoot: string): string {
  const relative = resFolder.slice('res://'.length);
  if (resourceRoot === '') return relative;
  return relative === '' ? resourceRoot : `${resourceRoot}/${relative}`;
}
