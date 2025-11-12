/**
 * Central registry for external resources.
 * Delegates actual loading to app-provided ResourceProvider.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { TscnExternalResource, ResourceNeededCallback } from '../parser/types';
import type { ResourceProvider } from './ResourceProvider';
import * as logger from '../logger';

export class ResourceRegistry {
  private resources: Map<string, TscnExternalResource> = new Map();
  private loadedCache: Map<string, string | ArrayBuffer> = new Map();
  private loadingPromises: Map<string, Promise<string | ArrayBuffer>> = new Map();
  private loadingStack: Set<string> = new Set();
  private provider: ResourceProvider | null = null;
  private textureCache: Map<string, THREE.Texture | null> = new Map();
  private materialCache: Map<string, THREE.Material | null> = new Map();
  private glbMeshCache: Map<string, THREE.Object3D | null> = new Map();
  private onResourceNeeded: ResourceNeededCallback | null = null;

  // In-flight tracking for texture, material, and GLB mesh loading
  private textureLoadingPromises: Map<string, Promise<THREE.Texture | null>> = new Map();
  private materialLoadingPromises: Map<string, Promise<THREE.Material | null>> = new Map();
  private glbMeshLoadingPromises: Map<string, Promise<THREE.Object3D | null>> = new Map();

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
   */
  async loadTexture(idOrPath: string): Promise<THREE.Texture | null> {
    const startTime = performance.now();
    const cacheStatus = this.textureCache.has(idOrPath) ? 'HIT' : 'MISS';

    logger.info(`[loadTexture] START: ${idOrPath} (cache: ${cacheStatus})`);

    return await this.loadWithDeduplication(
      idOrPath,
      this.textureCache,
      this.textureLoadingPromises,
      async (): Promise<THREE.Texture | null> => {
        // CRITICAL: This function must NEVER throw errors - always return null for failures
        // This ensures failed loads are cached and not retried
        try {
          // Get resource metadata
          const resource = this.getMetadata(idOrPath);
          if (!resource || !resource.type.includes('Texture')) {
            logger.error(`[loadTexture] ERROR: Not a texture resource: ${idOrPath}`);
            return null;
          }

          logger.info(`[loadTexture] LOADING: ${resource.path} for texture ${idOrPath}`);

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

            const elapsed = performance.now() - startTime;
            logger.info(`[loadTexture] SUCCESS: ${idOrPath} (${elapsed.toFixed(2)}ms)`);

            return texture;
          } finally {
            // Always clean up blob URL to prevent memory leaks
            URL.revokeObjectURL(blobUrl);
          }
        } catch (error) {
          // Texture failed to load - call onResourceNeeded callback
          const elapsed = performance.now() - startTime;
          const errorMsg = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : 'No stack trace';

          logger.error(`[loadTexture] FAILED: ${idOrPath} (${elapsed.toFixed(2)}ms)`);
          logger.error(`  Path: ${this.getMetadata(idOrPath)?.path || 'unknown'}`);
          logger.error(`  Error: ${errorMsg}`);
          logger.error(`  Stack trace:`, stack);

          if (this.onResourceNeeded) {
            try {
              const resource = this.getMetadata(idOrPath);
              if (resource) {
                logger.info(`[loadTexture] Calling onResourceNeeded callback for: ${idOrPath}`);
                await this.onResourceNeeded({
                  path: resource.path,
                  type: resource.type,
                  referencedBy: `Material using texture ${idOrPath}`,
                  error: errorMsg
                });
                logger.info(`[loadTexture] onResourceNeeded callback completed for: ${idOrPath}`);
              }
            } catch (callbackError) {
              // Log but don't propagate callback errors
              logger.error(`[loadTexture] onResourceNeeded callback FAILED for ${idOrPath}:`, callbackError);
            }
          }

          // Return null to allow rendering to continue without the texture
          logger.info(`[loadTexture] RETURNING NULL: ${idOrPath}`);
          return null;
        }
      }
    );
  }

  /**
   * Load material resource and return THREE.js Material.
   * Returns cached material if already loaded.
   * Returns null if material cannot be loaded (and calls onResourceNeeded if set).
   */
  async loadMaterial(idOrPath: string): Promise<THREE.Material | null> {
    const startTime = performance.now();
    const cacheStatus = this.materialCache.has(idOrPath) ? 'HIT' : 'MISS';

    logger.info(`[loadMaterial] START: ${idOrPath} (cache: ${cacheStatus})`);

    return await this.loadWithDeduplication(
      idOrPath,
      this.materialCache,
      this.materialLoadingPromises,
      async (): Promise<THREE.Material | null> => {
        // CRITICAL: This function must NEVER throw errors - always return null for failures
        // This ensures failed loads are cached and not retried
        try {
          // Get resource metadata
          const resource = this.getMetadata(idOrPath);
          if (!resource || !resource.type.includes('Material')) {
            logger.error(`[loadMaterial] ERROR: Not a material resource: ${idOrPath}`);
            return null;
          }

          logger.info(`[loadMaterial] LOADING: ${resource.path} for material ${idOrPath}`);

          // Load raw content via provider (returns string for .tres files)
          const content = await this.loadByPath(resource.path);
          if (typeof content !== 'string') {
            throw new Error(`Material must be text content: ${resource.path}`);
          }

          // Parse .tres file
          const { parseResourceFile } = await import('../parser/resourceParsers');
          const { type, properties } = parseResourceFile(content);

          // Parse and create material based on type
          let material: THREE.Material;

          switch (type) {
            case 'StandardMaterial3D': {
              const { parseStandardMaterial3D } = await import('./materials/standardmaterial3d/parser');
              const { createStandardMaterial } = await import('./materials/standardmaterial3d/renderer');

              // Convert parsed properties to string format for compatibility with existing parser
              const stringProps: Record<string, string> = {};
              for (const [key, value] of Object.entries(properties)) {
                if (value && typeof value === 'object' && 'type' in value) {
                  // Handle ParsedColor and ParsedVector3
                  if (value.type === 'Color' && 'r' in value && 'g' in value && 'b' in value && 'a' in value) {
                    stringProps[key] = `Color(${value.r}, ${value.g}, ${value.b}, ${value.a})`;
                  } else if (value.type === 'Vector3' && 'x' in value && 'y' in value && 'z' in value) {
                    stringProps[key] = `Vector3(${value.x}, ${value.y}, ${value.z})`;
                  } else {
                    stringProps[key] = String(value);
                  }
                } else {
                  stringProps[key] = String(value);
                }
              }

              const matProps = await parseStandardMaterial3D(stringProps, this);
              material = createStandardMaterial(matProps);
              break;
            }

            case 'ShaderMaterial':
              // Future: WI-16
              throw new Error('ShaderMaterial not yet supported');

            default:
              throw new Error(`Unsupported material type: ${type}`);
          }

          const elapsed = performance.now() - startTime;
          logger.info(`[loadMaterial] SUCCESS: ${idOrPath} (${elapsed.toFixed(2)}ms)`);

          return material;
        } catch (error) {
          // Material failed to load - call onResourceNeeded callback
          const elapsed = performance.now() - startTime;
          const errorMsg = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : 'No stack trace';

          logger.error(`[loadMaterial] FAILED: ${idOrPath} (${elapsed.toFixed(2)}ms)`);
          logger.error(`  Path: ${this.getMetadata(idOrPath)?.path || 'unknown'}`);
          logger.error(`  Error: ${errorMsg}`);
          logger.error(`  Stack trace:`, stack);

          if (this.onResourceNeeded) {
            try {
              const resource = this.getMetadata(idOrPath);
              if (resource) {
                logger.info(`[loadMaterial] Calling onResourceNeeded callback for: ${idOrPath}`);
                await this.onResourceNeeded({
                  path: resource.path,
                  type: resource.type,
                  referencedBy: `Node using material ${idOrPath}`,
                  error: errorMsg
                });
                logger.info(`[loadMaterial] onResourceNeeded callback completed for: ${idOrPath}`);
              }
            } catch (callbackError) {
              // Log but don't propagate callback errors
              logger.error(`[loadMaterial] onResourceNeeded callback FAILED for ${idOrPath}:`, callbackError);
            }
          }

          // Return null to allow rendering to continue without the material
          logger.info(`[loadMaterial] RETURNING NULL: ${idOrPath}`);
          return null;
        }
      }
    );
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
      this.textureCache.delete(path);
      this.textureLoadingPromises.delete(path);
      logger.info(`Cleared texture cache for: ${path}`);
    } else {
      this.textureCache.clear();
      this.textureLoadingPromises.clear();
      logger.info('Cleared all texture caches');
    }
  }

  /**
   * Clear material cache for specific path or all materials.
   * @param path - Optional path to clear specific material, omit to clear all
   */
  clearMaterialCache(path?: string): void {
    if (path) {
      this.materialCache.delete(path);
      this.materialLoadingPromises.delete(path);
      logger.info(`Cleared material cache for: ${path}`);
    } else {
      this.materialCache.clear();
      this.materialLoadingPromises.clear();
      logger.info('Cleared all material caches');
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
    this.textureCache.clear();
    this.materialCache.clear();
    this.glbMeshCache.clear();
    this.textureLoadingPromises.clear();
    this.materialLoadingPromises.clear();
    this.glbMeshLoadingPromises.clear();
    logger.info('ResourceRegistry cleared');
  }
}
