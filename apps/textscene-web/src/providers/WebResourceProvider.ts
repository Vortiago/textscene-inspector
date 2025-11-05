/**
 * ResourceProvider implementation for web browser environment.
 * Loads resources from user-uploaded files stored in memory.
 */

import { isBinaryResourceType } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';

export class WebResourceProvider implements ResourceProvider {
  private uploadedFiles: Map<string, File> = new Map();

  /**
   * Add a manually uploaded file.
   * @param path - Godot resource path (e.g., 'res://scenes/Door.tscn')
   * @param file - The uploaded File object
   */
  addUploadedFile(path: string, file: File): void {
    this.uploadedFiles.set(path, file);
  }

  /**
   * Get all uploaded files.
   */
  getUploadedFiles(): Map<string, File> {
    return this.uploadedFiles;
  }

  /**
   * Clear all uploaded files.
   */
  clearUploadedFiles(): void {
    this.uploadedFiles.clear();
  }

  async loadResource(path: string, type: string): Promise<string | ArrayBuffer> {
    // Check uploaded files first
    const uploadedFile = this.uploadedFiles.get(path);
    if (uploadedFile) {
      return isBinaryResourceType(type) ? uploadedFile.arrayBuffer() : uploadedFile.text();
    }

    // For PackedScene resources (.tscn files), try fetching from /fixtures/
    if (type === 'PackedScene' && path.startsWith('res://')) {
      try {
        // Convert Godot path to fixture path
        const filename = path.replace('res://', '');
        const fixtureUrl = `/fixtures/${filename}`;

        console.log(`[WebResourceProvider] Attempting to fetch external scene: ${fixtureUrl}`);
        const response = await fetch(fixtureUrl);

        if (response.ok) {
          const content = await response.text();
          console.log(`[WebResourceProvider] Successfully loaded external scene: ${path}`);
          return content;
        }
      } catch (error) {
        console.warn(`[WebResourceProvider] Failed to fetch external scene from fixtures: ${path}`, error);
      }
    }

    // Resource not available - will trigger onResourceNeeded callback
    throw new Error(`Resource not found: ${path}`);
  }

  hasResource(path: string): boolean {
    return this.uploadedFiles.has(path);
  }
}
