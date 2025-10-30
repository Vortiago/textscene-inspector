/**
 * ResourceProvider implementation for web browser environment.
 * Loads resources from user-uploaded files stored in memory.
 */

import { isBinaryResourceType } from '@textscene/renderer';
import type { ResourceProvider } from '@textscene/renderer';

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
    // Only load from uploaded files (uploaded by user or pre-loaded by fixture system)
    const uploadedFile = this.uploadedFiles.get(path);
    if (uploadedFile) {
      return isBinaryResourceType(type) ? uploadedFile.arrayBuffer() : uploadedFile.text();
    }

    // Resource not available - will trigger onResourceNeeded callback
    throw new Error(`Resource not found: ${path}`);
  }

  hasResource(path: string): boolean {
    return this.uploadedFiles.has(path);
  }
}
