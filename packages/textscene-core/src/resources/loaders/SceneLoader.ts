/**
 * Event-based scene loader with deduplication and caching.
 * Emits events for scene loading states.
 */

import type { TscnScene, ExtResource } from '../../parser/types';
import type { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { TscnParser } from '../../parser/TscnParser';
import * as logger from '../../logger';

export interface SceneMetadata {
  id: string;
  path: string;
  type: string;
}

export class SceneLoader {
  private cache = new Map<string, TscnScene | null>();
  private inflight = new Set<string>();
  private metadataMap = new Map<string, SceneMetadata>();
  private pathToIdMap = new Map<string, string>();
  private parser = new TscnParser();

  constructor(
    private eventBus: ResourceEventBus,
    private provider: ResourceProvider | null
  ) {}

  /**
   * Register scene metadata for lookup.
   * Allows lookup by both ID and path.
   */
  registerMetadata(id: string, resource: ExtResource): void {
    const metadata: SceneMetadata = {
      id,
      path: resource.path,
      type: resource.type,
    };
    this.metadataMap.set(id, metadata);
    this.metadataMap.set(resource.path, metadata);
    this.pathToIdMap.set(resource.path, id);
  }

  /**
   * Get registered metadata for a scene.
   */
  getMetadata(idOrPath: string): SceneMetadata | undefined {
    return this.metadataMap.get(idOrPath);
  }

  /**
   * Get the canonical ID for a path.
   */
  getIdForPath(path: string): string | undefined {
    return this.pathToIdMap.get(path);
  }

  /**
   * Check if scene is cached.
   */
  isCached(idOrPath: string): boolean {
    return this.cache.has(idOrPath);
  }

  /**
   * Check if scene is currently loading.
   */
  isLoading(idOrPath: string): boolean {
    return this.inflight.has(idOrPath);
  }

  /**
   * Get cached scene (may be null if load failed).
   */
  getCached(idOrPath: string): TscnScene | null | undefined {
    return this.cache.get(idOrPath);
  }

  /**
   * Request a scene to be loaded (non-blocking).
   * Emits events as loading progresses:
   * - scene:requested - When load initiated
   * - scene:loading - When actively loading
   * - scene:loaded - When successfully loaded (includes TscnScene in data)
   * - scene:failed - When load failed (includes error in data)
   *
   * If scene is cached, immediately emits scene:loaded.
   * If scene is already loading, does nothing (deduplication).
   */
  request(idOrPath: string): void {
    // Check cache first
    if (this.cache.has(idOrPath)) {
      const cached = this.cache.get(idOrPath);
      if (cached !== null) {
        logger.info(`[SceneLoader] Cache hit for: ${idOrPath}`);
        this.eventBus.emit<TscnScene>('scene', 'loaded', idOrPath, cached);
      } else {
        // Previously failed - emit failed again
        logger.info(`[SceneLoader] Cache hit (failed) for: ${idOrPath}`);
        this.eventBus.emit<Error>('scene', 'failed', idOrPath, new Error(`Scene ${idOrPath} previously failed to load`));
      }
      return;
    }

    // Deduplicate in-flight requests
    if (this.inflight.has(idOrPath)) {
      logger.info(`[SceneLoader] Already loading: ${idOrPath}`);
      return;
    }

    // Start loading
    this.eventBus.emit('scene', 'requested', idOrPath);
    this.loadAsync(idOrPath);
  }

  private async loadAsync(idOrPath: string): Promise<void> {
    this.inflight.add(idOrPath);
    this.eventBus.emit('scene', 'loading', idOrPath);
    const startTime = performance.now();

    try {
      const scene = await this.loadSceneFromProvider(idOrPath);
      this.cache.set(idOrPath, scene);
      this.inflight.delete(idOrPath);

      const elapsed = performance.now() - startTime;
      logger.info(`[SceneLoader] Loaded: ${idOrPath} (${elapsed.toFixed(2)}ms, ${scene.nodes.length} root nodes)`);
      this.eventBus.emit<TscnScene>('scene', 'loaded', idOrPath, scene);
    } catch (error) {
      this.cache.set(idOrPath, null); // Cache failure to prevent retries
      this.inflight.delete(idOrPath);

      const elapsed = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SceneLoader] Failed: ${idOrPath} (${elapsed.toFixed(2)}ms)`, err);
      this.eventBus.emit<Error>('scene', 'failed', idOrPath, err);
    }
  }

  private async loadSceneFromProvider(idOrPath: string): Promise<TscnScene> {
    const metadata = this.metadataMap.get(idOrPath);
    if (!metadata) {
      throw new Error(`Scene metadata not found: ${idOrPath}`);
    }

    if (metadata.type !== 'PackedScene') {
      throw new Error(`Not a PackedScene resource: ${idOrPath} (type: ${metadata.type})`);
    }

    if (!this.provider) {
      throw new Error('No ResourceProvider set');
    }

    // Load raw content
    const content = await this.provider.loadResource(metadata.path, metadata.type);
    if (typeof content !== 'string') {
      throw new Error(`Scene must be text content: ${metadata.path}`);
    }

    // Parse scene
    const scene = this.parser.parse(content);

    return scene;
  }

  /**
   * Clear cache for specific scene (for hot-reload).
   */
  clearCache(idOrPath: string): void {
    this.cache.delete(idOrPath);
    this.inflight.delete(idOrPath);
    logger.info(`[SceneLoader] Cleared cache for: ${idOrPath}`);
  }

  /**
   * Clear all cached scenes.
   */
  clearAllCache(): void {
    this.cache.clear();
    this.inflight.clear();
    logger.info('[SceneLoader] Cleared all cache');
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
