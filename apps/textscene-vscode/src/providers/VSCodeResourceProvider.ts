/**
 * The preview's ResourceProvider: it loads resources from the workspace filesystem. A `res://` path resolves under the
 * scene's `res://` root, the one the editor features use (`findResRootIn`). Any other path resolves under the scene's
 * own directory, as Godot resolves a relative path (`resource_format_text.cpp:490-513`).
 */

import * as vscode from 'vscode';
import { resourceContent } from '@textscene/core/resources/resourceProviderUtils';
import { info, error } from '@textscene/core/logger';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { comparablePath, isWithinRoot, RES_SCHEME, resRelativePath } from '@textscene/core/resources/resPath';
import { findResRootIn } from '../resRoot';
import { HOST_PATH_CASE } from '../hostPathCase';
import { readWorkspaceFile } from '../readWorkspaceFile';

export class VSCodeResourceProvider implements ResourceProvider {
  /** Written by the first `resRoot` call, and kept for this provider's lifetime. */
  private cachedResRoot: vscode.Uri | null = null;

  /**
   * Comparable fsPath -> the exact `res://` string a `loadResource` call resolved
   * it to. Recorded on resolution, before the read, so a resource not on disk yet
   * is still recorded and a later `onDidCreate` recovers it through
   * `getServedResPath`.
   */
  private servedResources = new Map<string, string>();

  constructor(
    private workspaceRoot: vscode.Uri,
    private documentUri: vscode.Uri
  ) {}

  async loadResource(resourcePath: string, type?: string): Promise<string | ArrayBuffer> {
    info(`[VSCodeResourceProvider] Loading ${type ?? 'file'}: ${resourcePath}`);
    try {
      const fsPath = await this.resolve(resourcePath);
      info(`[VSCodeResourceProvider] Resolved to: ${fsPath.fsPath}`);
      this.servedResources.set(comparablePath(fsPath.fsPath), resourcePath);
      const fileData = await readWorkspaceFile(fsPath);
      return resourceContent(fileData, type, resourcePath);
    } catch (cause) {
      const errorMsg = `Failed to load resource: ${resourcePath} (${cause instanceof Error ? cause.message : 'Unknown error'})`;
      error(`[VSCodeResourceProvider] ${errorMsg}`);
      throw new Error(errorMsg, { cause });
    }
  }

  /**
   * The exact `res://` string `loadResource` served for this fsPath, or `null`
   * when never served, so there is nothing to invalidate. A lookup with no IO, not
   * a re-derivation, so it ignores a watcher's casing.
   */
  getServedResPath(fileUri: vscode.Uri): string | null {
    return this.servedResources.get(comparablePath(fileUri.fsPath)) ?? null;
  }

  /** Every `res://` path `loadResource` served, for a caller that must re-fetch them all. */
  getServedResPaths(): string[] {
    return [...this.servedResources.values()];
  }

  /**
   * Whether a fresh walk finds another `res://` root than the cached one, after a
   * `project.godot` was created, moved or deleted. False before any load cached a
   * root, since no resource was then resolved against one.
   */
  async hasResRootMoved(): Promise<boolean> {
    if (!this.cachedResRoot) {
      return false;
    }
    const currentRoot = await findResRootIn(this.workspaceRoot, this.documentUri);
    return comparablePath(currentRoot.fsPath) !== comparablePath(this.cachedResRoot.fsPath);
  }

  /** The scene's `res://` root, cached for this provider's lifetime. `hasResRootMoved` tells the owner when to replace it. */
  private async resRoot(): Promise<vscode.Uri> {
    this.cachedResRoot ??= await findResRootIn(this.workspaceRoot, this.documentUri);
    return this.cachedResRoot;
  }

  /**
   * `resourcePath` as a Uri inside the workspace: a `res://` path under the `res://` root, any other path under the
   * scene's own directory, where a relative path may climb. It refuses a `res://` path that climbs out of its root, and
   * any path that lands outside the workspace, which blocks path traversal.
   */
  private async resolve(resourcePath: string): Promise<vscode.Uri> {
    const resolvedUri = resourcePath.startsWith(RES_SCHEME)
      ? vscode.Uri.joinPath(await this.resRoot(), resRootRelativePath(resourcePath))
      : vscode.Uri.joinPath(vscode.Uri.joinPath(this.documentUri, '..'), resourcePath);
    if (!isWithinRoot(this.workspaceRoot.fsPath, resolvedUri.fsPath, HOST_PATH_CASE)) {
      throw new Error(`Path traversal detected: ${resourcePath} resolves outside workspace bounds`);
    }
    return resolvedUri;
  }
}

/** `resPath` relative to its `res://` root. It throws for a path whose `..` climbs out of the root. */
function resRootRelativePath(resPath: string): string {
  const relativePath = resRelativePath(resPath);
  if (relativePath === null) {
    throw new Error(`Path traversal detected: ${resPath} climbs out of the res:// root`);
  }
  return relativePath;
}
