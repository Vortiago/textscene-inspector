/**
 * ResourceProvider implementation for VS Code environment.
 * Loads resources from the workspace filesystem.
 */

import * as vscode from 'vscode';
import { isBinaryResourceType, stripResPrefix, info, error } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';

export class VSCodeResourceProvider implements ResourceProvider {
  private projectRoot: vscode.Uri | null = null;

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

      const fileData = await vscode.workspace.fs.readFile(fsPath);
      info(`[VSCodeResourceProvider] Successfully read ${fileData.byteLength} bytes`);

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
    } catch (primaryError) {
      info(`[VSCodeResourceProvider] Primary resolution failed:`, primaryError);

      // If primary resolution failed, try relative to document's directory as fallback
      try {
        const relativePath = stripResPrefix(resourcePath);
        const documentDir = vscode.Uri.joinPath(this.documentUri, '..');
        const fallbackPath = vscode.Uri.joinPath(documentDir, relativePath);

        info(`[VSCodeResourceProvider] Trying fallback path: ${fallbackPath.fsPath}`);

        // Validate within workspace bounds
        const workspacePathNormalized = this.workspaceRoot.fsPath.toLowerCase().replace(/\\/g, '/');
        const fallbackPathNormalized = fallbackPath.fsPath.toLowerCase().replace(/\\/g, '/');

        if (fallbackPathNormalized.startsWith(workspacePathNormalized)) {
          const fileData = await vscode.workspace.fs.readFile(fallbackPath);
          info(`[VSCodeResourceProvider] Fallback succeeded: ${fileData.byteLength} bytes`);

          // Return as ArrayBuffer for binary files
          if (isBinaryResourceType(type, resourcePath)) {
            const buffer = new ArrayBuffer(fileData.byteLength);
            const view = new Uint8Array(buffer);
            view.set(fileData);
            return buffer;
          }

          // Return as string for text files
          return new TextDecoder('utf-8').decode(fileData);
        }
      } catch (fallbackError) {
        info(`[VSCodeResourceProvider] Fallback also failed:`, fallbackError);
      }

      const errorMsg = `Failed to load resource: ${resourcePath} (${primaryError instanceof Error ? primaryError.message : 'Unknown error'})`;
      error(`[VSCodeResourceProvider] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Find the Godot project root by searching for project.godot file.
   * Searches upward from the document location toward workspace root.
   * Falls back to document's directory if no project.godot is found.
   */
  private async findProjectRoot(): Promise<vscode.Uri> {
    if (this.projectRoot) {
      info(`[VSCodeResourceProvider] Using cached project root: ${this.projectRoot.fsPath}`);
      return this.projectRoot;
    }

    info(`[VSCodeResourceProvider] Searching for project.godot...`);

    // Start from document's directory
    let currentDir = vscode.Uri.joinPath(this.documentUri, '..');
    const startDir = currentDir; // Remember where we started for fallback

    info(`[VSCodeResourceProvider] Starting search from: ${currentDir.fsPath}`);

    // Normalize workspace root path for comparison
    const workspacePathNormalized = this.workspaceRoot.fsPath.toLowerCase().replace(/\\/g, '/');

    // Search upward until we find project.godot or reach workspace root
    while (true) {
      const currentPathNormalized = currentDir.fsPath.toLowerCase().replace(/\\/g, '/');

      // Try to find project.godot in current directory
      const projectFile = vscode.Uri.joinPath(currentDir, 'project.godot');
      info(`[VSCodeResourceProvider] Checking: ${projectFile.fsPath}`);

      try {
        await vscode.workspace.fs.stat(projectFile);
        // Found it!
        info(`[VSCodeResourceProvider] Found project.godot at: ${currentDir.fsPath}`);
        this.projectRoot = currentDir;
        return currentDir;
      } catch {
        // Not found, continue searching
      }

      // Check if we've reached or passed workspace root
      if (currentPathNormalized === workspacePathNormalized ||
          !currentPathNormalized.startsWith(workspacePathNormalized)) {
        // Reached workspace root without finding project.godot
        // Fall back to document's directory (where the .tscn file is)
        info(`[VSCodeResourceProvider] Reached workspace root, falling back to: ${startDir.fsPath}`);
        this.projectRoot = startDir;
        return startDir;
      }

      // Move up one directory
      currentDir = vscode.Uri.joinPath(currentDir, '..');
    }
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
    const workspacePathNormalized = this.workspaceRoot.fsPath.toLowerCase().replace(/\\/g, '/');
    const resolvedPathNormalized = resolvedUri.fsPath.toLowerCase().replace(/\\/g, '/');

    if (!resolvedPathNormalized.startsWith(workspacePathNormalized)) {
      throw new Error(
        `Path traversal detected: ${godotPath} resolves outside workspace bounds`
      );
    }

    return resolvedUri;
  }
}
