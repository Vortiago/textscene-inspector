/**
 * ResourceProvider implementation for VS Code environment.
 * Loads resources from the workspace filesystem.
 */

import * as vscode from 'vscode';
import { isBinaryResourceType, stripResPrefix } from '@textscene/core/resources/resourceProviderUtils';
import { info, error } from '@textscene/core/logger';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { findGodotProjectRoot } from '../findGodotProjectRoot';

/** Normalize an fsPath for use as a served-resources map key: forward slashes, lowercased. */
function normalizeFsPath(fsPath: string): string {
  return fsPath.replace(/\\/g, '/').toLowerCase();
}

export class VSCodeResourceProvider implements ResourceProvider {
  private projectRoot: vscode.Uri | null = null;

  /**
   * fsPath (normalized) -> the exact `res://` string a `loadResource` call
   * resolved it to. Recorded as soon as a candidate location is resolved
   * (either branch), *before* the read is attempted — a resource the scene
   * references but that doesn't exist on disk yet must still be recorded, so
   * a later `onDidCreate` for that exact path can recover it via
   * `getServedResPath`, instead of being silently treated as irrelevant.
   */
  private servedResources = new Map<string, string>();

  /** `workspaceRoot`, normalized once — it's constructor-fixed and reused on every resolution. */
  private readonly workspaceRootNormalized: string;

  constructor(
    private workspaceRoot: vscode.Uri,
    private documentUri: vscode.Uri
  ) {
    this.workspaceRootNormalized = normalizeFsPath(workspaceRoot.fsPath);
  }

  async loadResource(resourcePath: string, type: string): Promise<string | ArrayBuffer> {
    info(`[VSCodeResourceProvider] Loading ${type}: ${resourcePath}`);
    info(`[VSCodeResourceProvider] Workspace root: ${this.workspaceRoot.fsPath}`);
    info(`[VSCodeResourceProvider] Document URI: ${this.documentUri.fsPath}`);

    try {
      const fsPath = await this.resolveGodotPath(resourcePath);
      info(`[VSCodeResourceProvider] Resolved to: ${fsPath.fsPath}`);
      this.servedResources.set(normalizeFsPath(fsPath.fsPath), resourcePath);
      return await this.readContent(fsPath, resourcePath, type);
    } catch (primaryError) {
      info(`[VSCodeResourceProvider] Primary resolution failed:`, primaryError);

      // If primary resolution failed, try relative to document's directory as fallback
      try {
        const relativePath = stripResPrefix(resourcePath);
        const documentDir = vscode.Uri.joinPath(this.documentUri, '..');
        const fallbackPath = vscode.Uri.joinPath(documentDir, relativePath);

        info(`[VSCodeResourceProvider] Trying fallback path: ${fallbackPath.fsPath}`);

        // Validate within workspace bounds
        const fallbackPathNormalized = normalizeFsPath(fallbackPath.fsPath);

        if (fallbackPathNormalized.startsWith(this.workspaceRootNormalized)) {
          this.servedResources.set(normalizeFsPath(fallbackPath.fsPath), resourcePath);
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
   * Read an already-resolved fsPath and convert it to the shape `loadResource`
   * returns. Shared by the primary and fallback resolution branches, which
   * differ only in which `fsPath` they resolved to. Throw-transparent: a
   * `readFile` failure here propagates to the caller's try/catch unchanged, so
   * the primary branch's failure still falls through to the fallback branch,
   * and the fallback's failure still falls through to the final error.
   */
  private async readContent(
    fsPath: vscode.Uri,
    resourcePath: string,
    type: string
  ): Promise<string | ArrayBuffer> {
    const fileData = await vscode.workspace.fs.readFile(fsPath);
    info(`[VSCodeResourceProvider] Read ${fileData.byteLength} bytes`);

    // Return as ArrayBuffer for binary files (textures, audio, GLB/GLTF)
    if (isBinaryResourceType(type, resourcePath)) {
      // Create a new ArrayBuffer from Uint8Array
      const buffer = new ArrayBuffer(fileData.byteLength);
      const view = new Uint8Array(buffer);
      view.set(fileData);
      return buffer;
    }

    // Return as string for text files (scenes, scripts, shaders)
    return new TextDecoder('utf-8').decode(fileData);
  }

  /**
   * Look up the exact `res://` string previously served (via `loadResource`)
   * for this fsPath, or `null` if this provider never served it — meaning
   * either the file is irrelevant to the current scene, or it hasn't been
   * requested yet (either way, there is nothing to invalidate). No IO: this
   * replaces re-deriving the path via project-root-relative math, so it
   * round-trips resources resolved through the document-dir fallback branch
   * and is unaffected by on-disk casing differences from a file watcher.
   */
  getServedResPath(fileUri: vscode.Uri): string | null {
    return this.servedResources.get(normalizeFsPath(fileUri.fsPath)) ?? null;
  }

  /**
   * Find the Godot project root by searching for project.godot file.
   * Searches upward from the document location toward workspace root.
   * Falls back to the workspace root if no project.godot is found.
   * Delegates to the shared `findGodotProjectRoot` (also used by
   * `TscnDocumentLinkProvider`) and caches the result for this provider's
   * lifetime.
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
   * Convert Godot resource path (res://) to VS Code Uri.
   * Resolves relative to Godot project root (where project.godot is located).
   * Validates that resolved path stays within workspace bounds (prevents path traversal attacks).
   */
  private async resolveGodotPath(godotPath: string): Promise<vscode.Uri> {
    const relativePath = stripResPrefix(godotPath);

    // Find project root (where project.godot is located)
    const projectRoot = await this.findProjectRoot();

    // Resolve the path relative to project root
    const resolvedUri = vscode.Uri.joinPath(projectRoot, relativePath);

    // Validate that resolved path is within workspace bounds
    const resolvedPathNormalized = normalizeFsPath(resolvedUri.fsPath);

    if (!resolvedPathNormalized.startsWith(this.workspaceRootNormalized)) {
      throw new Error(
        `Path traversal detected: ${godotPath} resolves outside workspace bounds`
      );
    }

    return resolvedUri;
  }
}
