import * as vscode from 'vscode';
import type { ResRootsPort } from '@textscene/core/resources/resRoots';
import { anyCase } from '../anyCaseGlob';
import { HOST_PATH_CASE } from '../hostPathCase';
import { readWorkspaceFile } from '../readWorkspaceFile';
import { SCAN_STOP_FILES_PATTERN } from '../watchPatterns';
import { scannedResPaths } from './scannedResPaths';

const DOT_DIRECTORIES = '**/.*/**';

export function workspaceUriAt(folder: vscode.Uri, path: string): vscode.Uri {
  // Windows interprets a drive without the slash as relative to that drive's working directory.
  const isDriveRoot = folder.scheme === 'file' && /^\/[a-z]:$/i.test(path);
  return folder.with({ path: isDriveRoot ? `${path}/` : path });
}

/** The VS Code filesystem on the scheme and authority of one workspace folder. */
export function workspaceFsPort(folder: vscode.WorkspaceFolder): ResRootsPort {
  const uriAt = (path: string) => workspaceUriAt(folder.uri, path);
  const statAt = (path: string) =>
    vscode.workspace.fs.stat(uriAt(path)).then(
      (stat) => stat,
      () => null
    );

  return {
    pathCase: HOST_PATH_CASE,
    async stat(path) {
      const stat = await statAt(path);
      return (
        stat && { isFile: (stat.type & vscode.FileType.File) !== 0, mtimeMs: stat.mtime, size: stat.size }
      );
    },
    async realPath(path) {
      const stat = await statAt(path);
      return stat && (stat.type & vscode.FileType.Directory) !== 0 ? path : null;
    },
    async list(path) {
      try {
        const entries = await vscode.workspace.fs.readDirectory(uriAt(path));
        return entries.map(([name, type]) => ({
          name,
          isDirectory:
            (type & vscode.FileType.Directory) !== 0 && (type & vscode.FileType.SymbolicLink) === 0,
        }));
      } catch {
        return [];
      }
    },
    async read(path) {
      return readWorkspaceFile(uriAt(path)).catch(() => null);
    },
    async scan(path, extension) {
      const root = uriAt(path);
      const glob = extension === undefined ? '**/*' : `**/*.${anyCase(extension)}`;
      try {
        const [files, stopFiles] = await Promise.all([
          vscode.workspace.findFiles(
            new vscode.RelativePattern(root, glob),
            extension === undefined ? DOT_DIRECTORIES : null
          ),
          vscode.workspace.findFiles(new vscode.RelativePattern(root, SCAN_STOP_FILES_PATTERN), null),
        ]);
        return scannedResPaths(root, files, stopFiles);
      } catch {
        return null;
      }
    },
  };
}
