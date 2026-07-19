/**
 * ResourceProvider implementation for web browser environment.
 * Loads resources from user-uploaded files stored in memory.
 */

import { isBinaryResourceType, info, warn } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';
import { fixtureUrlForRes } from '../corpusRoot';

export class WebResourceProvider implements ResourceProvider {
  /** Uploaded files, keyed per corpus root via {@link uploadKey}. */
  private uploadedFiles: Map<string, File> = new Map();
  /**
   * Public-fixtures subtree the active scene's res:// namespace maps onto.
   * '' = the fixtures root (unit fixtures, examples, the flattened isometric
   * corpus); vendored demo projects each set their own root (e.g.
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
   * Remove an uploaded file under EVERY corpus root, not just the active one.
   * The uploaded-rows UI keys on the bare res:// path and survives corpus
   * switches, so a root-scoped delete would silently no-op after a switch —
   * the row would vanish while the file kept being served whenever its
   * original corpus became active again. Remove is an explicit user action
   * on the path itself; deleting it everywhere matches what the row shows.
   * After removal, requesting the path again falls through to the fixtures
   * fetch (or fails).
   */
  removeUploadedFile(path: string): boolean {
    const suffix = `\0${path}`;
    let removed = false;
    for (const key of this.uploadedFiles.keys()) {
      if (key.endsWith(suffix)) {
        this.uploadedFiles.delete(key);
        removed = true;
      }
    }
    return removed;
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
        const fixtureUrl = fixtureUrlForRes(path, this.resourceRoot);

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
