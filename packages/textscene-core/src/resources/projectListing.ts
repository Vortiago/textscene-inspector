/**
 * A project's files by extension, for a host that reads its directories itself: the walk Godot's editor scan makes
 * (`godot/editorScan.ts`), over a directory reader the host supplies.
 */

import { SCAN_STOP_FILES, isScannedDirectoryName } from '../godot/index.js';

/** One entry of a directory, as a host's reader reports it. */
export interface DirectoryEntry {
  readonly name: string;
  /** True for a directory, a link to one included. */
  readonly isDirectory: boolean;
}

/** Reads the entries of the directory at a `res://` path, `res://` itself for the root. */
export type DirectoryReader = (directory: string) => Promise<readonly DirectoryEntry[]>;

const ROOT = 'res://';

/** The `res://` path of `name` inside `directory`. */
function childPath(directory: string, name: string): string {
  return directory === ROOT ? `${ROOT}${name}` : `${directory}/${name}`;
}

/**
 * The `res://` path of every file under `res://` whose extension is `extension`, in any case, in the directories the
 * scan enters. No extension lists every file. A sub-directory that holds a {@link SCAN_STOP_FILES} file is skipped
 * whole.
 */
export async function listScannedFiles(
  readDirectory: DirectoryReader,
  extension?: string
): Promise<string[]> {
  const suffix = extension === undefined ? '' : `.${extension.toLowerCase()}`;
  const found: string[] = [];
  const walk = async (directory: string, entries: readonly DirectoryEntry[]): Promise<void> => {
    for (const { name, isDirectory } of entries) {
      const path = childPath(directory, name);
      if (!isDirectory) {
        if (name.toLowerCase().endsWith(suffix)) found.push(path);
        continue;
      }
      if (!isScannedDirectoryName(name)) continue;
      const children = await readDirectory(path);
      if (children.some((child) => !child.isDirectory && SCAN_STOP_FILES.includes(child.name))) continue;
      await walk(path, children);
    }
  };
  await walk(ROOT, await readDirectory(ROOT));
  return found;
}
