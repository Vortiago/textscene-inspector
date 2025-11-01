/**
 * Central registry for external resources.
 * Delegates actual loading to app-provided ResourceProvider.
 */

import type { TscnExternalResource, TscnScene } from '../parser/types';
import type { ResourceProvider } from './ResourceProvider';
import * as logger from '../logger';

export class ResourceRegistry {
  private resources: Map<string, TscnExternalResource> = new Map();
  private loadedCache: Map<string, string | ArrayBuffer> = new Map();
  private loadingPromises: Map<string, Promise<string | ArrayBuffer>> = new Map();
  private loadingStack: Set<string> = new Set();
  private parsedSceneCache: Map<string, TscnScene> = new Map();
  private provider: ResourceProvider | null = null;

  /**
   * Register an external resource from parsed TSCN data.
   */
  register(resource: TscnExternalResource): void {
    // Register by both local ID and path for flexible lookup
    if (resource.id) {
      this.resources.set(resource.id, resource);
    }
    this.resources.set(resource.path, resource);

    logger.info(`Registered resource: ${resource.type} id="${resource.id}" at ${resource.path}`);
  }

  /**
   * Set the resource provider for loading resources.
   */
  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
  }

  /**
   * Get resource metadata by path.
   */
  getMetadata(path: string): TscnExternalResource | undefined {
    return this.resources.get(path);
  }

  /**
   * Get all registered resources.
   * Returns unique resources (deduplicated since resources are registered by both ID and path).
   */
  getAllResources(): TscnExternalResource[] {
    const seen = new Set<string>();
    const unique: TscnExternalResource[] = [];

    for (const resource of this.resources.values()) {
      if (!seen.has(resource.path)) {
        seen.add(resource.path);
        unique.push(resource);
      }
    }

    return unique;
  }

  /**
   * Load a resource by path.
   * Returns cached result if already loaded.
   * Handles circular dependencies.
   */
  async loadByPath(path: string): Promise<string | ArrayBuffer> {
    // Check cache first
    if (this.loadedCache.has(path)) {
      logger.info(`Using cached resource: ${path}`);
      return this.loadedCache.get(path)!;
    }

    // Check if already loading (avoid duplicate loads)
    if (this.loadingPromises.has(path)) {
      logger.info(`Waiting for in-flight load: ${path}`);
      return await this.loadingPromises.get(path)!;
    }

    // Check for circular dependencies
    if (this.loadingStack.has(path)) {
      throw new Error(`Circular dependency detected: ${path}`);
    }

    const resource = this.resources.get(path);
    if (!resource) {
      throw new Error(`Resource not found in registry: ${path}`);
    }

    if (!this.provider) {
      throw new Error('No ResourceProvider set. Call setProvider() before loading resources.');
    }

    // Track loading
    this.loadingStack.add(path);
    logger.info(`Loading resource: ${path} (${resource.type})`);

    // Create loading promise
    const loadingPromise = this.provider
      .loadResource(resource.path, resource.type)
      .then((loaded) => {
        this.loadedCache.set(path, loaded);
        this.loadingStack.delete(path);
        this.loadingPromises.delete(path);
        logger.info(`Successfully loaded resource: ${path}`);
        return loaded;
      })
      .catch((error) => {
        this.loadingStack.delete(path);
        this.loadingPromises.delete(path);
        logger.error(`Failed to load resource: ${path}`, error);
        throw error;
      });

    this.loadingPromises.set(path, loadingPromise);
    return await loadingPromise;
  }

  /**
   * Load and parse a PackedScene resource.
   * Returns cached parsed scene if already loaded and parsed.
   * Caches both raw content and parsed scene for performance.
   */
  async loadAndParseScene(
    path: string,
    parser: { parse(content: string): TscnScene }
  ): Promise<TscnScene> {
    // Check parsed scene cache first
    if (this.parsedSceneCache.has(path)) {
      logger.info(`Using cached parsed scene: ${path}`);
      return this.parsedSceneCache.get(path)!;
    }

    // Load raw content (uses existing file cache)
    const content = await this.loadByPath(path);

    if (typeof content !== 'string') {
      throw new Error(`Expected text content for scene ${path}, got ${typeof content}`);
    }

    // Parse and cache
    logger.info(`Parsing scene: ${path}`);
    const scene = parser.parse(content);
    this.parsedSceneCache.set(path, scene);
    logger.info(`Cached parsed scene: ${path} with ${scene.nodes.length} root nodes`);

    return scene;
  }

  /**
   * Parse ExtResource("id") reference and return the path.
   * Returns null if not a valid ExtResource reference.
   */
  static parseReference(value: string): string | null {
    // Match: ExtResource("1_abc") or ExtResource("uid://...")
    const match = value.match(/ExtResource\("([^"]+)"\)/);
    return match?.[1] ?? null;
  }

  /**
   * Check if a resource exists in the registry.
   */
  hasResource(path: string): boolean {
    return this.resources.has(path);
  }

  /**
   * Clear cache for specific resource (for hot-reload).
   * This forces the resource to be reloaded on next access.
   */
  clearCache(path: string): void {
    this.loadedCache.delete(path);
    this.loadingPromises.delete(path);
    this.parsedSceneCache.delete(path);
    logger.info(`Cleared cache for: ${path}`);
  }

  /**
   * Clear all cached resources and registered metadata.
   */
  clear(): void {
    this.resources.clear();
    this.loadedCache.clear();
    this.loadingPromises.clear();
    this.loadingStack.clear();
    this.parsedSceneCache.clear();
    logger.info('ResourceRegistry cleared');
  }
}
