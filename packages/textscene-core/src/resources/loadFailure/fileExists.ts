/** Whether a file exists for Godot's loader, from the listing of its folder. */

import { foldersAbove, type DirectoryListing } from '../directoryListing';
import { importSidecarPath } from '../../godot/project/resourceFormats';

/** The folder whose listing holds `path`. */
export function folderOf(path: string): string {
  return foldersAbove(path)[0] ?? 'res://';
}

/**
 * An imported file loads through its sidecar's remap (resource_importer.cpp:45). A null listing is a
 * host that cannot list, which finds every file, so no failure is claimed that the host cannot see.
 */
export function existsInListing(path: string, listing: DirectoryListing | null): boolean {
  return listing === null || listsName(listing, fileName(path)) || listsImportSidecar(path, listing);
}

export function listsImportSidecar(path: string, listing: DirectoryListing | null): boolean {
  return listing !== null && listsName(listing, importSidecarPath(fileName(path)));
}

function listsName(listing: DirectoryListing, name: string): boolean {
  return listing.kind === 'listed' && listing.entries.some((entry) => entry.name === name);
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
