/** The browser ResourceProvider: uploaded files in memory, then the fixtures mirror. */

import { isBinaryResourceType, info, warn } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';
import { fixtureUrlForRes } from '../corpusRoot';

export interface WebResourceProviderOptions {
  /**
   * Whether the site serves the `/fixtures/` mirror. The public edition does not, so a
   * missing res:// path goes to the upload prompt without a request that can only 404.
   */
  hasFixturesMirror?: boolean;
}

export class WebResourceProvider implements ResourceProvider {
  private readonly hasFixturesMirror: boolean;

  constructor({ hasFixturesMirror = true }: WebResourceProviderOptions = {}) {
    this.hasFixturesMirror = hasFixturesMirror;
  }

  /** Uploaded files, keyed per corpus root by {@link uploadKey}. */
  private uploadedFiles: Map<string, File> = new Map();
  /**
   * Public-fixtures subtree the active scene's res:// namespace maps onto: '' for
   * the fixtures root (unit fixtures, examples, the flattened isometric corpus),
   * or a demo project's own root, such as 'demos/2d/platformer', so paths never collide.
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
   * Adds an uploaded file, scoped to the active corpus root, so another root does
   * not see it.
   * @param path - Godot resource path, such as 'res://scenes/Door.tscn'
   * @param file - The uploaded File object
   */
  addUploadedFile(path: string, file: File): void {
    this.uploadedFiles.set(this.uploadKey(path), file);
  }

  /**
   * Removes an uploaded file under every corpus root. The uploaded-rows UI keys on
   * the bare res:// path across corpus switches, so a root-scoped delete no-ops
   * after a switch while the row vanishes. A later request falls through to the
   * fixtures fetch.
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
    // Uploaded files of the active corpus root first.
    const uploadedFile = this.uploadedFiles.get(this.uploadKey(path));
    if (uploadedFile) {
      return isBinaryResourceType(type, path) ? uploadedFile.arrayBuffer() : uploadedFile.text();
    }

    if (this.hasFixturesMirror && path.startsWith('res://')) {
      try {
        // Convert Godot path to fixture path under the active corpus root.
        const fixtureUrl = fixtureUrlForRes(path, this.resourceRoot);

        info(`[WebResourceProvider] Attempting to fetch ${type}: ${fixtureUrl}`);
        const response = await fetch(fixtureUrl);

        if (response.ok) {
          // A missing file comes back as the SPA's HTML fallback.
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
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

    // The throw triggers the onResourceNeeded callback.
    throw new Error(`Resource not found: ${path}`);
  }
}
