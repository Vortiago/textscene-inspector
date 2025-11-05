/**
 * Central registry for external resources.
 * Delegates actual loading to app-provided ResourceProvider.
 */

import * as THREE from 'three';
import type { TscnExternalResource, ResourceNeededCallback } from '../parser/types';
import type { ResourceProvider } from './ResourceProvider';
import * as logger from '../logger';

export class ResourceRegistry {
  private resources: Map<string, TscnExternalResource> = new Map();
  private loadedCache: Map<string, string | ArrayBuffer> = new Map();
  private loadingPromises: Map<string, Promise<string | ArrayBuffer>> = new Map();
  private loadingStack: Set<string> = new Set();
  private provider: ResourceProvider | null = null;
  private textureCache: Map<string, THREE.Texture> = new Map();
  private onResourceNeeded: ResourceNeededCallback | null = null;

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
   * Set callback for when a resource is needed but not available.
   */
  setOnResourceNeeded(callback: ResourceNeededCallback): void {
    this.onResourceNeeded = callback;
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
   * Load texture resource and return THREE.js Texture.
   * Returns cached texture if already loaded.
   * Returns null if texture cannot be loaded (and calls onResourceNeeded if set).
   */
  async loadTexture(idOrPath: string): Promise<THREE.Texture | null> {
    // Check texture cache first
    if (this.textureCache.has(idOrPath)) {
      logger.info(`Using cached texture: ${idOrPath}`);
      return this.textureCache.get(idOrPath)!;
    }

    // Get resource metadata
    const resource = this.getMetadata(idOrPath);
    if (!resource || !resource.type.includes('Texture')) {
      logger.error(`Not a texture resource: ${idOrPath}`);
      return null;
    }

    try {
      // Load raw content via provider (returns ArrayBuffer)
      const content = await this.loadByPath(resource.path);
      if (!(content instanceof ArrayBuffer)) {
        throw new Error(`Texture must be binary data: ${resource.path}`);
      }

      // Convert ArrayBuffer to Blob
      const mimeType = this.getMimeType(resource.path);
      const blob = new Blob([content], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      // Load with THREE.js TextureLoader
      const loader = new THREE.TextureLoader();

      try {
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            blobUrl,
            (loadedTexture: THREE.Texture) => {
              loadedTexture.colorSpace = THREE.SRGBColorSpace;
              resolve(loadedTexture);
            },
            undefined,
            () => {
              reject(new Error(`Failed to load texture: ${resource.path}`));
            }
          );
        });

        // Cache the loaded texture
        this.textureCache.set(idOrPath, texture);
        logger.info(`Successfully loaded texture: ${resource.path}`);

        return texture;
      } finally {
        // Always clean up blob URL to prevent memory leaks
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      // Texture failed to load - call onResourceNeeded callback
      logger.warn(`Texture not available: ${resource.path}`);

      if (this.onResourceNeeded) {
        try {
          await this.onResourceNeeded({
            path: resource.path,
            type: resource.type,
            referencedBy: `Material using texture ${idOrPath}`,
            error: error instanceof Error ? error.message : String(error)
          });
        } catch (callbackError) {
          // Log but don't propagate callback errors
          logger.warn(`onResourceNeeded callback failed:`, callbackError);
        }
      }

      // Return null to allow rendering to continue without the texture
      return null;
    }
  }

  /**
   * Get MIME type from file extension.
   */
  private getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'svg':
        return 'image/svg+xml';
      case 'webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
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
    this.textureCache.clear();
    logger.info('ResourceRegistry cleared');
  }
}
