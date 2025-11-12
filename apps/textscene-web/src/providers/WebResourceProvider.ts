/**
 * ResourceProvider implementation for web browser environment.
 * Loads resources from user-uploaded files stored in memory.
 */

import { isBinaryResourceType, info, warn } from '@textscene/core';
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
      return isBinaryResourceType(type, path) ? uploadedFile.arrayBuffer() : uploadedFile.text();
    }

    // For resources from /fixtures/, try fetching them
    if (path.startsWith('res://')) {
      try {
        // Convert Godot path to fixture path
        const filename = path.replace('res://', '');
        const fixtureUrl = `/fixtures/${filename}`;

        info(`[WebResourceProvider] Attempting to fetch ${type}: ${fixtureUrl}`);
        const response = await fetch(fixtureUrl);

        if (response.ok) {
          // Check Content-Type to detect if server returned HTML fallback (missing file)
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            // Server returned HTML fallback (SPA behavior) - file doesn't exist
            warn(`[WebResourceProvider] File not found (got HTML fallback): ${path}`);
            throw new Error(`Resource not found: ${path}`);
          }

          if (isBinaryResourceType(type, path)) {
            const content = await response.arrayBuffer();
            info(`[WebResourceProvider] Successfully loaded ${type}: ${path}`);
            return content;
          } else {
            const content = await response.text();
            info(`[WebResourceProvider] Successfully loaded ${type}: ${path}`);
            return content;
          }
        }
      } catch (error) {
        warn(`[WebResourceProvider] Failed to fetch ${type} from fixtures: ${path}`, error);
      }
    }

    // Resource not available - will trigger onResourceNeeded callback
    throw new Error(`Resource not found: ${path}`);
  }

  hasResource(path: string): boolean {
    return this.uploadedFiles.has(path);
  }
}
