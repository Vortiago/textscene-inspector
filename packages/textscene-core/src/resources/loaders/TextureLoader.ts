/**
 * Event-based texture loader with deduplication and caching.
 * Emits events for texture loading states and supports both
 * event-based and promise-based (backward-compatible) APIs.
 */

import * as THREE from 'three';
import type { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import type { TscnExternalResource } from '../../parser/types';
import * as logger from '../../logger';

export interface TextureMetadata {
  id: string;
  path: string;
  type: string;
}

export class TextureLoader {
  private cache = new Map<string, THREE.Texture | null>();
  private inflight = new Set<string>();
  private metadataMap = new Map<string, TextureMetadata>();
  private failedTextures = new Map<string, TextureMetadata>();

  constructor(
    private eventBus: ResourceEventBus,
    private provider: ResourceProvider | null,
    private getMimeType: (path: string) => string
  ) {
    // Listen for resource:provided events to auto-retry failed textures
    this.eventBus.on<string>('resource', 'provided', (path) => {
      for (const [id, metadata] of this.failedTextures) {
        if (metadata.path === path) {
          logger.info(`[TextureLoader] Auto-retrying texture ${id} after resource provided: ${path}`);
          this.retryFailed(id);
        }
      }
    });
  }

  /**
   * Register texture metadata for lookup.
   */
  registerMetadata(id: string, resource: TscnExternalResource): void {
    this.metadataMap.set(id, {
      id,
      path: resource.path,
      type: resource.type,
    });
  }

  /**
   * Get registered metadata for a texture.
   */
  getMetadata(id: string): TextureMetadata | undefined {
    return this.metadataMap.get(id);
  }

  /**
   * Check if texture is cached.
   */
  isCached(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Check if texture is currently loading.
   */
  isLoading(id: string): boolean {
    return this.inflight.has(id);
  }

  /**
   * Get cached texture (may be null if load failed).
   */
  getCached(id: string): THREE.Texture | null | undefined {
    return this.cache.get(id);
  }

  /**
   * Request a texture to be loaded (non-blocking).
   * Emits events as loading progresses:
   * - texture:requested - When load initiated
   * - texture:loading - When actively loading
   * - texture:loaded - When successfully loaded (includes texture in data)
   * - texture:failed - When load failed (includes error in data)
   *
   * If texture is cached, immediately emits texture:loaded.
   * If texture is already loading, does nothing (deduplication).
   */
  request(id: string): void {
    // Check cache first
    if (this.cache.has(id)) {
      const cached = this.cache.get(id);
      if (cached !== null) {
        logger.info(`[TextureLoader] Cache hit for: ${id}`);
        this.eventBus.emit<THREE.Texture>('texture', 'loaded', id, cached);
      } else {
        // Previously failed - emit failed again
        logger.info(`[TextureLoader] Cache hit (failed) for: ${id}`);
        this.eventBus.emit<Error>('texture', 'failed', id, new Error(`Texture ${id} previously failed to load`));
      }
      return;
    }

    // Deduplicate in-flight requests
    if (this.inflight.has(id)) {
      logger.info(`[TextureLoader] Already loading: ${id}`);
      return;
    }

    // Start loading
    this.eventBus.emit('texture', 'requested', id);
    this.loadAsync(id);
  }

  /**
   * Load texture and return via promise (backward-compatible API).
   * Uses event bus internally.
   */
  async load(id: string): Promise<THREE.Texture | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Set up promise FIRST to ensure handlers are registered before any sync events
    const resultPromise = this.eventBus
      .once<THREE.Texture>('texture', 'loaded', id)
      .catch((error) => {
        logger.warn(`[TextureLoader] load() failed for: ${id}`, error);
        return null;
      });

    this.request(id);
    return resultPromise;
  }

  private async loadAsync(id: string): Promise<void> {
    this.inflight.add(id);
    this.eventBus.emit('texture', 'loading', id);
    const startTime = performance.now();

    try {
      const texture = await this.loadTextureFromProvider(id);
      this.cache.set(id, texture);
      this.inflight.delete(id);

      const elapsed = performance.now() - startTime;
      logger.info(`[TextureLoader] Loaded: ${id} (${elapsed.toFixed(2)}ms)`);
      this.eventBus.emit<THREE.Texture>('texture', 'loaded', id, texture);
    } catch (error) {
      this.cache.set(id, null); // Cache failure to prevent retries
      this.inflight.delete(id);

      // Track failed texture for potential retry when resource is provided
      const metadata = this.metadataMap.get(id);
      if (metadata) {
        this.failedTextures.set(id, metadata);
      }

      const elapsed = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[TextureLoader] Failed: ${id} (${elapsed.toFixed(2)}ms)`, err);
      this.eventBus.emit<Error>('texture', 'failed', id, err);
    }
  }

  private async loadTextureFromProvider(id: string): Promise<THREE.Texture> {
    const metadata = this.metadataMap.get(id);
    if (!metadata) {
      throw new Error(`Texture metadata not found: ${id}`);
    }

    if (!metadata.type.includes('Texture')) {
      throw new Error(`Not a texture resource: ${id} (type: ${metadata.type})`);
    }

    if (!this.provider) {
      throw new Error('No ResourceProvider set');
    }

    // Load raw content
    const content = await this.provider.loadResource(metadata.path, metadata.type);
    if (!(content instanceof ArrayBuffer)) {
      throw new Error(`Texture must be binary data: ${metadata.path}`);
    }

    // Convert to blob URL
    const mimeType = this.getMimeType(metadata.path);
    const blob = new Blob([content], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    try {
      // Load with THREE.js TextureLoader
      const threeLoader = new THREE.TextureLoader(this.eventBus.getThreeManager());
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        threeLoader.load(
          blobUrl,
          (loadedTexture: THREE.Texture) => {
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            resolve(loadedTexture);
          },
          undefined,
          (errorEvent: unknown) => {
            const detail = errorEvent instanceof Error ? `: ${errorEvent.message}` : '';
            reject(new Error(`Failed to decode texture: ${metadata.path}${detail}`));
          }
        );
      });

      return texture;
    } finally {
      // Always clean up blob URL
      URL.revokeObjectURL(blobUrl);
    }
  }

  /**
   * Clear cache for specific texture (for hot-reload).
   */
  clearCache(id: string): void {
    this.cache.delete(id);
    this.inflight.delete(id);
    logger.info(`[TextureLoader] Cleared cache for: ${id}`);
  }

  /**
   * Clear all cached textures.
   */
  clearAllCache(): void {
    this.cache.clear();
    this.inflight.clear();
    this.failedTextures.clear();
    logger.info('[TextureLoader] Cleared all cache');
  }

  /**
   * Retry loading a previously failed texture.
   * Used when a missing resource is provided by the user.
   */
  retryFailed(id: string): void {
    if (!this.failedTextures.has(id)) {
      logger.info(`[TextureLoader] No failed texture to retry: ${id}`);
      return;
    }

    // Clear failed status and cache entry
    this.failedTextures.delete(id);
    this.cache.delete(id);

    logger.info(`[TextureLoader] Retrying failed texture: ${id}`);
    this.request(id);
  }

  /**
   * Get map of failed textures (for debugging/recovery UI).
   */
  getFailedTextures(): Map<string, TextureMetadata> {
    return new Map(this.failedTextures);
  }

  /**
   * Check if a texture has failed to load.
   */
  hasFailed(id: string): boolean {
    return this.failedTextures.has(id);
  }

  /**
   * Set the resource provider.
   */
  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
  }

  /**
   * Get cache size for debugging.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get number of in-flight requests.
   */
  getInflightCount(): number {
    return this.inflight.size;
  }
}
