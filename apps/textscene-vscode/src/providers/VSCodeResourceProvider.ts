/** The VS Code ResourceProvider: it loads resources from the workspace filesystem. */

import * as vscode from 'vscode';
import { isBinaryResourceType, stripResPrefix } from '@textscene/core/resources/resourceProviderUtils';
import { info, error } from '@textscene/core/logger';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { comparablePath, isWithinRoot, normalizeRelativePath } from '@textscene/core/resources/resPath';
import { findGodotProjectRoot } from '../findGodotProjectRoot';

export class VSCodeResourceProvider implements ResourceProvider {
  private projectRoot: vscode.Uri | null = null;

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

  async loadResource(resourcePath: string, type: string): Promise<string | ArrayBuffer> {
    info(`[VSCodeResourceProvider] Loading ${type}: ${resourcePath}`);
    info(`[VSCodeResourceProvider] Workspace root: ${this.workspaceRoot.fsPath}`);
    info(`[VSCodeResourceProvider] Document URI: ${this.documentUri.fsPath}`);

    try {
      const fsPath = await this.resolveGodotPath(resourcePath);
      info(`[VSCodeResourceProvider] Resolved to: ${fsPath.fsPath}`);
      this.servedResources.set(comparablePath(fsPath.fsPath), resourcePath);
      return await this.readContent(fsPath, resourcePath, type);
    } catch (primaryError) {
      info(`[VSCodeResourceProvider] Primary resolution failed:`, primaryError);

      // Fallback: relative to the document's directory. A `..` that climbs above it is
      // refused here as in `resolveGodotPath`, or this branch reads what that one refused.
      try {
        const relativePath = normalizeRelativePath(stripResPrefix(resourcePath));
        const documentDir = vscode.Uri.joinPath(this.documentUri, '..');
        const fallbackPath = relativePath === null ? null : vscode.Uri.joinPath(documentDir, relativePath);

        if (fallbackPath && isWithinRoot(this.workspaceRoot.fsPath, fallbackPath.fsPath)) {
          info(`[VSCodeResourceProvider] Trying fallback path: ${fallbackPath.fsPath}`);
          this.servedResources.set(comparablePath(fallbackPath.fsPath), resourcePath);
          return await this.readContent(fallbackPath, resourcePath, type);
        }
      } catch (fallbackError) {
        info(`[VSCodeResourceProvider] Fallback also failed:`, fallbackError);
      }

      const errorMsg = `Failed to load resource: ${resourcePath} (${primaryError instanceof Error ? primaryError.message : 'Unknown error'})`;
      error(`[VSCodeResourceProvider] ${errorMsg}`);
      throw new Error(errorMsg, { cause: primaryError });
    }
  }

  /**
   * Reads a resolved fsPath into the shape `loadResource` returns, for both
   * branches. A `readFile` failure propagates unchanged, so the primary branch
   * falls through to the fallback, and the fallback to the final error.
   */
  private async readContent(
    fsPath: vscode.Uri,
    resourcePath: string,
    type: string
  ): Promise<string | ArrayBuffer> {
    const fileData = await vscode.workspace.fs.readFile(fsPath);
    info(`[VSCodeResourceProvider] Read ${fileData.byteLength} bytes`);

    // Binary files (textures, audio, GLB/GLTF) return an ArrayBuffer.
    if (isBinaryResourceType(type, resourcePath)) {
      const buffer = new ArrayBuffer(fileData.byteLength);
      const view = new Uint8Array(buffer);
      view.set(fileData);
      return buffer;
    }

    // Text files (scenes, scripts, shaders) return a string.
    return new TextDecoder('utf-8').decode(fileData);
  }

  /**
   * The exact `res://` string `loadResource` served for this fsPath, or `null`
   * when never served, so there is nothing to invalidate. A lookup with no IO, not
   * a re-derivation, so it round-trips the fallback branch and ignores a watcher's
   * casing.
   */
  getServedResPath(fileUri: vscode.Uri): string | null {
    return this.servedResources.get(comparablePath(fileUri.fsPath)) ?? null;
  }

  /**
   * The Godot project root from the shared `findGodotProjectRoot`, cached for this
   * provider's lifetime.
   */
  private async findProjectRoot(): Promise<vscode.Uri> {
    if (this.projectRoot) {
      info(`[VSCodeResourceProvider] Using cached project root: ${this.projectRoot.fsPath}`);
      return this.projectRoot;
    }

    info(`[VSCodeResourceProvider] Searching for project.godot...`);
    this.projectRoot = await findGodotProjectRoot(this.workspaceRoot, this.documentUri);
    info(`[VSCodeResourceProvider] Project root resolved to: ${this.projectRoot.fsPath}`);
    return this.projectRoot;
  }

  /**
   * Resolves a `res://` path against the project root into a VS Code Uri, and
   * refuses one that climbs out of the project root or lands outside the
   * workspace, which blocks path traversal.
   */
  private async resolveGodotPath(godotPath: string): Promise<vscode.Uri> {
    const relativePath = normalizeRelativePath(stripResPrefix(godotPath));
    if (relativePath === null) {
      throw new Error(`Path traversal detected: ${godotPath} climbs out of the project root`);
    }

    const resolvedUri = vscode.Uri.joinPath(await this.findProjectRoot(), relativePath);

    if (!isWithinRoot(this.workspaceRoot.fsPath, resolvedUri.fsPath)) {
      throw new Error(
        `Path traversal detected: ${godotPath} resolves outside workspace bounds`
      );
    }

    return resolvedUri;
  }
}
