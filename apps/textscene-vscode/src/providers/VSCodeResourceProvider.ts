import * as vscode from 'vscode';
import { PROJECT_FILE_PATH } from '@textscene/core/godot';
import { resourceContent } from '@textscene/core/resources/resourceProviderUtils';
import { info, error } from '@textscene/core/logger';
import type { DirectoryEntry } from '@textscene/core/resources/projectListing';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import {
  forwardSlashes,
  isSamePath,
  isWithinRoot,
  pathKey,
  RES_SCHEME,
} from '@textscene/core/resources/resPath';
import type { WorkspaceResRoot, WorkspaceResRoots } from '../resRoots/workspaceResRoots';
import { HOST_PATH_CASE } from '../hostPathCase';
import { readWorkspaceFile } from '../readWorkspaceFile';

export class VSCodeResourceProvider implements ResourceProvider {
  private servedRoot: WorkspaceResRoot | null = null;

  // Record the URI before reading, so a file created later can refresh its missing placeholder.
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
      this.servedResources.set(resourceKey(fsPath), resourcePath);
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
      // A folder the host cannot read has no usable listing.
      return null;
    }
  }

  getServedResPath(fileUri: vscode.Uri): string | null {
    return this.servedResources.get(resourceKey(fileUri)) ?? null;
  }

  /**
   * The `res://` path of `fileUri`, or null when it lies outside the scene's `res://` root, or the scene lies outside the
   * workspace so no root exists. For a file the preview never loaded, whose creation or removal still edits a folder listing.
   */
  async resPathOf(fileUri: vscode.Uri): Promise<string | null> {
    const root = await this.roots.rootOf(this.documentUri).catch(() => null);
    if (root === null || !isWithinDirectory(root.uri, fileUri)) return null;
    const rootPath = forwardSlashes(root.uri.path);
    const filePath = forwardSlashes(fileUri.path);
    if (isSamePath(rootPath, filePath, HOST_PATH_CASE)) return null;
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

  private async resolve(resourcePath: string): Promise<vscode.Uri> {
    const root = await this.roots.rootOf(this.documentUri);
    if (resourcePath.startsWith(RES_SCHEME)) {
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

    const bound = root && (await root.existingFile(PROJECT_FILE_PATH)) ? root.uri : this.workspaceRoot;
    const uri = vscode.Uri.joinPath(directoryOf(this.documentUri), resourcePath);
    if (!isWithinDirectory(bound, uri)) {
      throw new Error(
        `Path traversal detected: ${resourcePath} resolves outside workspace bounds (${bound.path})`
      );
    }
    this.servedRoot = root;
    return uri;
  }
}

function isWithinDirectory(directory: vscode.Uri, file: vscode.Uri): boolean {
  return (
    file.scheme === directory.scheme &&
    file.authority === directory.authority &&
    isWithinRoot(directory.path, file.path, HOST_PATH_CASE)
  );
}

function resourceKey(uri: vscode.Uri): string {
  return JSON.stringify([uri.scheme, uri.authority, pathKey(uri.path, HOST_PATH_CASE)]);
}

function directoryOf(documentUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(documentUri, '..');
}
