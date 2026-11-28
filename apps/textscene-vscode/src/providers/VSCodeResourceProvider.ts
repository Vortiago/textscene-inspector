import * as vscode from 'vscode';
import { resourceContent } from '@textscene/core/resources/resourceProviderUtils';
import { info, error } from '@textscene/core/logger';
import type { DirectoryEntry } from '@textscene/core/resources/projectListing';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { forwardSlashes, isWithinRoot, pathKey, RES_SCHEME } from '@textscene/core/resources/resPath';
import type { WorkspaceResRoot, WorkspaceResRoots } from '../resRoots/workspaceResRoots';
import { HOST_PATH_CASE } from '../hostPathCase';
import { readWorkspaceFile } from '../readWorkspaceFile';

export class VSCodeResourceProvider implements ResourceProvider {
  private servedRoot: WorkspaceResRoot | null = null;

  /**
   * The exact `res://` string a `loadResource` call resolved to, by the key of its fsPath in the host's path case.
   * Recorded on resolution, before the read, so a resource not on disk yet is still recorded and a later
   * `onDidCreate` recovers it through `getServedResPath`.
   */
  private servedResources = new Map<string, string>();

  constructor(
    private readonly roots: WorkspaceResRoots,
    private readonly workspaceRoot: vscode.Uri,
    private readonly documentUri: vscode.Uri
  ) {}

  async loadResource(resourcePath: string, type?: string, maxBytes?: number): Promise<string | ArrayBuffer> {
    info(`[VSCodeResourceProvider] Loading ${type ?? 'file'}: ${resourcePath}`);
    try {
      const fsPath = await this.resolve(resourcePath);
      info(`[VSCodeResourceProvider] Resolved to: ${fsPath.fsPath}`);
      this.servedResources.set(pathKey(fsPath.fsPath, HOST_PATH_CASE), resourcePath);
      const fileData = await readWorkspaceFile(fsPath);
      // The host reads the whole file, as `vscode.workspace.fs` has no ranged read and the web host build
      // takes no Node builtin. Cutting here keeps the rest out of the base64 string and the webview.
      return resourceContent(
        maxBytes === undefined ? fileData : fileData.subarray(0, maxBytes),
        type,
        resourcePath
      );
    } catch (cause) {
      const errorMsg = `Failed to load resource: ${resourcePath} (${cause instanceof Error ? cause.message : 'Unknown error'})`;
      error(`[VSCodeResourceProvider] ${errorMsg}`);
      throw new Error(errorMsg, { cause });
    }
  }

  /**
   * The entries of the `res://` folder `folder`, or null when the workspace has no such folder. A link to a folder is
   * a folder.
   */
  async listDirectory(folder: string): Promise<DirectoryEntry[] | null> {
    try {
      const directory = await this.resolve(folder);
      const entries = await vscode.workspace.fs.readDirectory(directory);
      return entries.map(([name, type]) => ({ name, isDirectory: (type & vscode.FileType.Directory) !== 0 }));
    } catch {
      // A folder the host lacks or refuses, or one outside the workspace, is a folder Godot would refuse.
      return null;
    }
  }

  /**
   * The exact `res://` string `loadResource` served for this fsPath, or `null` when never served, so there is nothing
   * to invalidate. A lookup with no IO, not a re-derivation, so on a case-insensitive host it ignores a watcher's case.
   */
  getServedResPath(fileUri: vscode.Uri): string | null {
    return this.servedResources.get(pathKey(fileUri.fsPath, HOST_PATH_CASE)) ?? null;
  }

  /**
   * The `res://` path of `fileUri`, or null when it lies outside the scene's `res://` root, or the scene lies outside the
   * workspace so no root exists. For a file the preview never loaded, whose creation or removal still edits a folder listing.
   */
  async resPathOf(fileUri: vscode.Uri): Promise<string | null> {
    const root = await this.roots.rootOf(this.documentUri).catch(() => null);
    if (root === null) return null;
    const rootPath = forwardSlashes(root.uri.fsPath);
    const filePath = forwardSlashes(fileUri.fsPath);
    if (filePath === rootPath || !isWithinRoot(rootPath, filePath, HOST_PATH_CASE)) return null;
    return `${RES_SCHEME}${filePath.slice(rootPath.length).replace(/^\//, '')}`;
  }

  /** Every `res://` path `loadResource` served, for a caller that must re-fetch them all. */
  getServedResPaths(): string[] {
    return [...this.servedResources.values()];
  }

  async hasResRootMoved(): Promise<boolean> {
    const servedRoot = this.servedRoot;
    return servedRoot !== null && (await this.roots.rootOf(this.documentUri)) !== servedRoot;
  }

  private async resolveResPath(resourcePath: string): Promise<vscode.Uri> {
    const root = await this.roots.rootOf(this.documentUri);
    if (!root) {
      throw new Error(
        `expected ${this.documentUri.fsPath} inside the workspace ${this.workspaceRoot.fsPath}`
      );
    }
    const uri = root.uriOf(resourcePath);
    if (!uri) throw new Error(`Path traversal detected: ${resourcePath} climbs out of the res:// root`);
    this.servedRoot = root;
    return uri;
  }

  /**
   * `resourcePath` as a Uri inside the workspace: a `res://` path under the `res://` root, any other path under the
   * scene's own directory, where a relative path may climb. It refuses a `res://` path that climbs out of its root, and
   * any path that lands outside the workspace, which blocks path traversal.
   */
  private async resolve(resourcePath: string): Promise<vscode.Uri> {
    const resolvedUri = resourcePath.startsWith(RES_SCHEME)
      ? await this.resolveResPath(resourcePath)
      : vscode.Uri.joinPath(directoryOf(this.documentUri), resourcePath);
    if (!isWithinRoot(this.workspaceRoot.fsPath, resolvedUri.fsPath, HOST_PATH_CASE)) {
      throw new Error(`Path traversal detected: ${resourcePath} resolves outside workspace bounds`);
    }
    return resolvedUri;
  }
}

function directoryOf(documentUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(documentUri, '..');
}
