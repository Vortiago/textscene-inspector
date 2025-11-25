/**
 * Central registry for external resources.
 * Delegates actual loading to app-provided ResourceProvider.
 * Supports both promise-based (legacy) and event-based (new) loading APIs.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { TscnExternalResource, ResourceNeededCallback } from '../parser/types';
import type { ResourceProvider } from './ResourceProvider';
import { ResourceEventBus } from './ResourceEventBus';
import { TextureLoader } from './loaders/TextureLoader';
import { MaterialLoader } from './loaders/MaterialLoader';
import * as logger from '../logger';

export class ResourceRegistry {
  private resources: Map<string, TscnExternalResource> = new Map();
  private loadedCache: Map<string, string | ArrayBuffer> = new Map();
  private loadingPromises: Map<string, Promise<string | ArrayBuffer>> = new Map();
  private loadingStack: Set<string> = new Set();
  private provider: ResourceProvider | null = null;
  private glbMeshCache: Map<string, THREE.Object3D | null> = new Map();
  private onResourceNeeded: ResourceNeededCallback | null = null;

  // Event-based loading infrastructure
  private eventBus: ResourceEventBus;
  private textureLoader: TextureLoader;
  private materialLoader: MaterialLoader;

  // In-flight tracking for GLB mesh loading
  private glbMeshLoadingPromises: Map<string, Promise<THREE.Object3D | null>> = new Map();

  constructor() {
    this.eventBus = new ResourceEventBus();
    this.textureLoader = new TextureLoader(
      this.eventBus,
      null,
      (path) => this.getMimeType(path)
    );
    this.materialLoader = new MaterialLoader(this.eventBus, null, this);

    // Wire up onResourceNeeded callback to texture failed events
    this.eventBus.on<Error>('texture', 'failed', (id, error) => {
      if (this.onResourceNeeded) {
        const resource = this.getMetadata(id);
        if (resource) {
          const result = this.onResourceNeeded({
            path: resource.path,
            type: resource.type,
            referencedBy: `Material using texture ${id}`,
            error: error?.message || 'Unknown error',
          });
          // Handle both sync and async callbacks
          if (result && typeof result.catch === 'function') {
            result.catch((err) => {
              logger.error(`[ResourceRegistry] onResourceNeeded callback failed:`, err);
            });
          }
        }
      }
    });

    // Wire up onResourceNeeded callback to material failed events
    this.eventBus.on<Error>('material', 'failed', (id, error) => {
      if (this.onResourceNeeded) {
        const resource = this.getMetadata(id);
        if (resource) {
          const result = this.onResourceNeeded({
            path: resource.path,
            type: resource.type,
            referencedBy: `Node using material ${id}`,
            error: error?.message || 'Unknown error',
          });
          // Handle both sync and async callbacks
          if (result && typeof result.catch === 'function') {
            result.catch((err) => {
              logger.error(`[ResourceRegistry] onResourceNeeded callback failed:`, err);
            });
          }
        }
      }
    });
  }

  /**
   * Register an external resource from parsed TSCN data.
   */
  register(resource: TscnExternalResource): void {
    // Register by both local ID and path for flexible lookup
    if (resource.id) {
      this.resources.set(resource.id, resource);
    }
    this.resources.set(resource.path, resource);

    // Also register with TextureLoader if it's a texture (by both ID and path)
    if (resource.type.includes('Texture')) {
      if (resource.id) {
        this.textureLoader.registerMetadata(resource.id, resource);
      }
      this.textureLoader.registerMetadata(resource.path, resource);
    }

    // Also register with MaterialLoader if it's a material (by both ID and path)
    if (resource.type.includes('Material')) {
      if (resource.id) {
        this.materialLoader.registerMetadata(resource.id, resource);
      }
      this.materialLoader.registerMetadata(resource.path, resource);
    }

    logger.info(`Registered resource: ${resource.type} id="${resource.id}" at ${resource.path}`);
  }

  /**
   * Set the resource provider for loading resources.
   */
  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
    this.textureLoader.setProvider(provider);
    this.materialLoader.setProvider(provider);
  }

  /**
   * Get the resource event bus for event-based loading.
   * Use this to subscribe to texture/material/scene loading events.
   */
  getEventBus(): ResourceEventBus {
    return this.eventBus;
  }

  /**
   * Request a texture to be loaded (non-blocking, event-based).
   * Subscribe to 'texture:loaded' and 'texture:failed' events for results.
   */
  requestTexture(idOrPath: string): void {
    this.textureLoader.request(idOrPath);
  }

  /**
   * Request a material to be loaded (non-blocking, event-based).
   * Subscribe to 'material:loaded' and 'material:failed' events for results.
   */
  requestMaterial(idOrPath: string): void {
    this.materialLoader.request(idOrPath);
  }

  /**
   * Set callback for when a resource is needed but not available.
   */
  setOnResourceNeeded(callback: ResourceNeededCallback): void {
    this.onResourceNeeded = callback;
  }

  /**
   * Generic helper for loading resources with deduplication.
   * Prevents multiple simultaneous loads of the same resource.
   *
   * @param key - Unique identifier for the resource
   * @param cache - Cache map for successfully loaded resources
   * @param loadingPromises - Map tracking in-flight loading operations
   * @param loadFn - Async function that performs the actual loading
   * @returns Loaded resource or null if loading fails
   */
  private async loadWithDeduplication<T>(
    key: string,
    cache: Map<string, T | null>,
    loadingPromises: Map<string, Promise<T | null>>,
    loadFn: () => Promise<T | null>
  ): Promise<T | null> {
    // Check cache first
    if (cache.has(key)) {
      logger.info(`[loadWithDeduplication] Cache hit for: ${key}`);
      return cache.get(key)!;
    }

    // Check if already loading (deduplication)
    if (loadingPromises.has(key)) {
      logger.info(`[loadWithDeduplication] Waiting for in-flight load: ${key}`);
      return await loadingPromises.get(key)!;
    }

    // Start loading and track the promise
    logger.info(`[loadWithDeduplication] Starting new load: ${key}`);
    const loadingPromise = loadFn()
      .then((result) => {
        // Cache ALL results, including null (failed loads), to prevent retries
        cache.set(key, result);
        if (result !== null) {
          logger.info(`[loadWithDeduplication] Cached successful load: ${key}`);
        } else {
          logger.info(`[loadWithDeduplication] Cached null result (failed load): ${key}`);
        }
        loadingPromises.delete(key);
        return result;
      })
      .catch((error) => {
        // Don't cache failures, just clean up
        loadingPromises.delete(key);
        logger.error(`[loadWithDeduplication] Load failed for ${key}:`, error);
        throw error;
      });

    loadingPromises.set(key, loadingPromise);
    return await loadingPromise;
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
   *
   * This is the backward-compatible promise API. For event-based loading,
   * use requestTexture() and subscribe to texture:loaded/texture:failed events.
   */
  async loadTexture(idOrPath: string): Promise<THREE.Texture | null> {
    // Delegate to the TextureLoader which handles caching, deduplication,
    // and event emission internally
    return await this.textureLoader.load(idOrPath);
  }

  /**
   * Load material resource and return THREE.js Material.
   * Returns cached material if already loaded.
   * Returns null if material cannot be loaded (and calls onResourceNeeded if set).
   *
   * This is the backward-compatible promise API. For event-based loading,
   * use requestMaterial() and subscribe to material:loaded/material:failed events.
   */
  async loadMaterial(idOrPath: string): Promise<THREE.Material | null> {
    // Delegate to the MaterialLoader which handles caching, deduplication,
    // and event emission internally
    return await this.materialLoader.load(idOrPath);
  }

  /**
   * Load GLB/GLTF mesh resource and return THREE.js Object3D.
   * Returns cached mesh if already loaded.
   * Returns null if mesh cannot be loaded (and calls onResourceNeeded if set).
   *
   * IMPORTANT: Always returns a cloned copy of the cached Object3D.
   * This is necessary because THREE.Object3D can only have ONE parent at a time.
   * Without cloning, multiple instances would share the same object, causing
   * each new instance to remove the object from its previous parent.
   */
  async loadGLBMesh(idOrPath: string): Promise<THREE.Object3D | null> {
    const startTime = performance.now();
    const cacheStatus = this.glbMeshCache.has(idOrPath) ? 'HIT' : 'MISS';

    logger.info(`[loadGLBMesh] START: ${idOrPath} (cache: ${cacheStatus})`);

    const cachedMesh = await this.loadWithDeduplication(
      idOrPath,
      this.glbMeshCache,
      this.glbMeshLoadingPromises,
      async (): Promise<THREE.Object3D | null> => {
        // CRITICAL: This function must NEVER throw errors - always return null for failures
        // This ensures failed loads are cached and not retried
        try {
          // Get resource metadata
          const resource = this.getMetadata(idOrPath);
          if (!resource) {
            logger.error(`[loadGLBMesh] ERROR: Resource not found: ${idOrPath}`);
            return null;
          }

          // Check if it's a GLB/GLTF file
          const ext = resource.path.split('.').pop()?.toLowerCase();
          if (ext !== 'glb' && ext !== 'gltf') {
            logger.error(`[loadGLBMesh] ERROR: Not a GLB/GLTF file: ${resource.path}`);
            return null;
          }

          logger.info(`[loadGLBMesh] LOADING: ${resource.path} for mesh ${idOrPath}`);

          // Load raw content via provider (returns ArrayBuffer)
          const content = await this.loadByPath(resource.path);
          if (!(content instanceof ArrayBuffer)) {
            throw new Error(`GLB/GLTF must be binary data: ${resource.path}`);
          }

          // Parse with GLTFLoader
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(content, '');

          // Return the scene from the GLTF (which is a THREE.Group)
          const mesh = gltf.scene;

          const elapsed = performance.now() - startTime;
          logger.info(`[loadGLBMesh] SUCCESS: ${idOrPath} (${elapsed.toFixed(2)}ms)`);

          return mesh;
        } catch (error) {
          // GLB mesh failed to load - call onResourceNeeded callback
          const elapsed = performance.now() - startTime;
          const errorMsg = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : 'No stack trace';

          logger.error(`[loadGLBMesh] FAILED: ${idOrPath} (${elapsed.toFixed(2)}ms)`);
          logger.error(`  Path: ${this.getMetadata(idOrPath)?.path || 'unknown'}`);
          logger.error(`  Error: ${errorMsg}`);
          logger.error(`  Stack trace:`, stack);

          if (this.onResourceNeeded) {
            try {
              const resource = this.getMetadata(idOrPath);
              if (resource) {
                logger.info(`[loadGLBMesh] Calling onResourceNeeded callback for: ${idOrPath}`);
                await this.onResourceNeeded({
                  path: resource.path,
                  type: resource.type,
                  referencedBy: `Node using GLB mesh ${idOrPath}`,
                  error: errorMsg
                });
                logger.info(`[loadGLBMesh] onResourceNeeded callback completed for: ${idOrPath}`);
              }
            } catch (callbackError) {
              // Log but don't propagate callback errors
              logger.error(`[loadGLBMesh] onResourceNeeded callback FAILED for ${idOrPath}:`, callbackError);
            }
          }

          // Return null to allow rendering to continue without the mesh
          logger.info(`[loadGLBMesh] RETURNING NULL: ${idOrPath}`);
          return null;
        }
      }
    );

    // Clone the cached mesh for this instance
    // CRITICAL: THREE.Object3D can only have ONE parent at a time
    // Without cloning, multiple instances would share the same object reference,
    // and adding it to a new parent would remove it from the previous parent
    if (cachedMesh === null) {
      logger.info(`[loadGLBMesh] Returning null (load failed): ${idOrPath}`);
      return null;
    }

    // Clone recursively (true = deep clone including children and geometry)
    const clonedMesh = cachedMesh.clone(true);

    // Clone materials for all meshes in the hierarchy
    // CRITICAL: clone(true) clones Object3D hierarchy but NOT materials
    // Without this, all instances would share material references
    clonedMesh.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        if (Array.isArray(node.material)) {
          node.material = node.material.map((mat) => mat.clone());
        } else {
          node.material = node.material.clone();
        }
      }
    });

    const elapsed = performance.now() - startTime;
    logger.info(`[loadGLBMesh] Returning cloned instance: ${idOrPath} (${elapsed.toFixed(2)}ms total)`);

    return clonedMesh;
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
   * Resolve instance reference to scene path.
   * Handles parsing, validation, and error logging.
   * Returns scene path if valid PackedScene, null otherwise.
   */
  resolveInstancePath(instanceRef: string | undefined): string | null {
    if (!instanceRef) {
      return null;
    }

    // Parse resource ID from ExtResource("id") format
    const resourceId = ResourceRegistry.parseReference(instanceRef);
    if (!resourceId) {
      logger.warn(`[ResourceRegistry] Invalid instance reference format: ${instanceRef}`);
      return null;
    }

    // Look up resource metadata
    const metadata = this.getMetadata(resourceId);
    if (!metadata) {
      logger.warn(`[ResourceRegistry] Instance resource not found: ${resourceId}`);
      return null;
    }

    // Validate resource type
    if (metadata.type !== 'PackedScene') {
      logger.warn(
        `[ResourceRegistry] Instance resource is not a PackedScene: ${resourceId} ` +
        `(type: ${metadata.type})`
      );
      return null;
    }

    return metadata.path;
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
   * Clear texture cache for specific path or all textures.
   * @param path - Optional path to clear specific texture, omit to clear all
   */
  clearTextureCache(path?: string): void {
    if (path) {
      this.textureLoader.clearCache(path);
    } else {
      this.textureLoader.clearAllCache();
    }
  }

  /**
   * Clear material cache for specific path or all materials.
   * @param path - Optional path to clear specific material, omit to clear all
   */
  clearMaterialCache(path?: string): void {
    if (path) {
      this.materialLoader.clearCache(path);
    } else {
      this.materialLoader.clearAllCache();
    }
  }

  /**
   * Clear GLB mesh cache for specific path or all meshes.
   * @param path - Optional path to clear specific mesh, omit to clear all
   */
  clearGLBMeshCache(path?: string): void {
    if (path) {
      this.glbMeshCache.delete(path);
      this.glbMeshLoadingPromises.delete(path);
      logger.info(`Cleared GLB mesh cache for: ${path}`);
    } else {
      this.glbMeshCache.clear();
      this.glbMeshLoadingPromises.clear();
      logger.info('Cleared all GLB mesh caches');
    }
  }

  /**
   * Clear all cached resources and registered metadata.
   */
  clear(): void {
    this.resources.clear();
    this.loadedCache.clear();
    this.loadingPromises.clear();
    this.loadingStack.clear();
    this.textureLoader.clearAllCache();
    this.materialLoader.clearAllCache();
    this.glbMeshCache.clear();
    this.glbMeshLoadingPromises.clear();
    this.eventBus.clear();
    logger.info('ResourceRegistry cleared');
  }
}
