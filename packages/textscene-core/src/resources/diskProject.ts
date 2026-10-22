/// <reference types="node" />

/**
 * The `node:fs` adapter of {@link ResRoots}, for the Node hosts: the `tscn-lint` CLI and the `tscn-lsp` server. Only a
 * Node bundle imports this module, since it reads `node:fs`. An eslint rule keeps every browser bundle away from it.
 */

import type { Dirent } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DirectoryEntry } from './projectListing.js';
import { pathCaseOf } from './resPath.js';
import { createResRoots, type ResRoots, type ResRootsPort } from './resRoots.js';

/** Whether `entry` of `directory` is a directory or a link to one, since the scan follows a link too. */
async function isDirectoryEntry(directory: string, entry: Dirent): Promise<boolean> {
  if (!entry.isSymbolicLink()) return entry.isDirectory();
  try {
    return (await stat(resolve(directory, entry.name))).isDirectory();
  } catch {
    // A dangling link is no directory, as the scan's own `stat` finds (`dir_access_unix.cpp:167-175`).
    return false;
  }
}

/** Whether this platform's filesystem tells apart two spellings of a path that differ only in case. */
export const DISK_PATH_CASE = pathCaseOf(process.platform);

/** The disk behind {@link ResRootsPort}. */
const diskPort: ResRootsPort = {
  pathCase: DISK_PATH_CASE,
  async stat(path) {
    try {
      const stats = await stat(path);
      return { isFile: stats.isFile(), mtimeMs: stats.mtimeMs, size: stats.size };
    } catch {
      // Absent or unreadable: either way there is no file to open.
      return null;
    }
  },
  async realPath(directory) {
    try {
      return await realpath(directory);
    } catch {
      // The scan skips a directory it cannot enter (`editor_file_system.cpp:1201-1202`).
      return null;
    }
  },
  async list(directory): Promise<DirectoryEntry[]> {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return await Promise.all(
        entries.map(async (entry) => ({
          name: entry.name,
          isDirectory: await isDirectoryEntry(directory, entry),
        }))
      );
    } catch {
      // The scan skips a directory it cannot enter (`editor_file_system.cpp:1201-1202`).
      return [];
    }
  },
  async read(path) {
    try {
      return await readFile(path);
    } catch {
      // A missing dependency is the missing-resource path, which the provider contract spells as null.
      return null;
    }
  },
};

/**
 * The roots of the scenes in `workspace` read from the disk, or of any scene for a null workspace. A host makes one
 * and asks it for every scene, so the answers it reads are shared.
 */
export function createDiskResRoots(workspace: string | null): ResRoots {
  return createResRoots(diskPort, workspace === null ? null : resolve(workspace));
}
