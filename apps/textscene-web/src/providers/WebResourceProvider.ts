/**
 * ResourceProvider implementation for web browser environment.
 * Loads resources from user-uploaded files stored in memory.
 */

import { isBinaryResourceType, info, warn } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';

export class WebResourceProvider implements ResourceProvider {
  private uploadedFiles: Map<string, File> = new Map();
  /**
   * Public-fixtures subtree the active scene's res:// namespace maps onto.
   * '' = the fixtures root (unit fixtures, examples, ld-58, isometric);
   * vendored demo projects each set their own root (e.g.
   * 'demos/2d/platformer') so their res:// paths cannot collide.
   */
  private resourceRoot = '';

  setResourceRoot(root: string): void {
    this.resourceRoot = root;
  }

  /**
   * Add a manually uploaded file.
   * @param path - Godot resource path (e.g., 'res://scenes/Door.tscn')
   * @param file - The uploaded File object
   */
  addUploadedFile(path: string, file: File): void {
    this.uploadedFiles.set(path, file);
  }

  /**
   * Remove a single uploaded file. After removal, requesting the path
   * again falls through to the fixtures fetch (or fails).
   */
  removeUploadedFile(path: string): boolean {
    return this.uploadedFiles.delete(path);
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
        // Convert Godot path to fixture path under the active corpus root.
        const filename = path.replace('res://', '');
        const prefix = this.resourceRoot ? `${this.resourceRoot}/` : '';
        const fixtureUrl = `/fixtures/${prefix}${filename}`;

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

}
