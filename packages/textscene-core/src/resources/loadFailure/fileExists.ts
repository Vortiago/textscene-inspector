import { foldersAbove, type DirectoryListing } from '../directoryListing';
import { importSidecarPath } from '../../godot/project/resourceFormats';

/** The folder whose listing holds `path`. */
export function folderOf(path: string): string {
  return foldersAbove(path)[0] ?? 'res://';
}

/** An import exists through its sidecar (resource_importer.cpp:45). */
export function existsInListing(path: string, listing: DirectoryListing): boolean {
  return listsName(listing, fileName(path)) || listsImportSidecar(path, listing);
}

export function listsImportSidecar(path: string, listing: DirectoryListing | null): boolean {
  return listing !== null && listsName(listing, importSidecarPath(fileName(path)));
}

// Any case, as the walk cannot tell the file system (file_access_windows.cpp:191, file_access_unix.cpp:116).
function listsName(listing: DirectoryListing, name: string): boolean {
  const key = name.toLowerCase();
  return listing.kind === 'listed' && listing.entries.some((entry) => entry.name.toLowerCase() === key);
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
