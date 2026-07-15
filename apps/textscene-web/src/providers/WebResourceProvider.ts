/**
 * ResourceProvider implementation for web browser environment.
 * Loads resources from user-uploaded files stored in memory.
 */

import { isBinaryResourceType, info, warn } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';

export class WebResourceProvider implements ResourceProvider {
  /** Uploaded files, keyed per corpus root via {@link uploadKey}. */
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
   * Compound storage key: active corpus root + NUL separator + res:// path.
   * Scopes every upload to the corpus root active when it was added, so a
   * file uploaded in corpus A is never served under a different corpus root.
   */
  private uploadKey(path: string): string {
    return `${this.resourceRoot}\0${path}`;
  }

  /**
   * Add a manually uploaded file, scoped to the currently-active corpus root.
   * Uploading while corpus A is active will NOT make the file visible when the
   * provider is later switched to a different corpus root.
   * @param path - Godot resource path (e.g., 'res://scenes/Door.tscn')
   * @param file - The uploaded File object
   */
  addUploadedFile(path: string, file: File): void {
    this.uploadedFiles.set(this.uploadKey(path), file);
  }

  /**
   * Remove a single uploaded file from the currently-active corpus root.
   * After removal, requesting the path again falls through to the fixtures
   * fetch (or fails).
   */
  removeUploadedFile(path: string): boolean {
    return this.uploadedFiles.delete(this.uploadKey(path));
  }

  async loadResource(path: string, type: string): Promise<string | ArrayBuffer> {
    // Check uploaded files first (only for the active corpus root)
    const uploadedFile = this.uploadedFiles.get(this.uploadKey(path));
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
