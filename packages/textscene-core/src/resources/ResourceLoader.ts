/**
 * Event-based resource loader using factory-based processors.
 * Provides request methods and event subscriptions for resource loading.
 */

import * as THREE from 'three';
import type { ExtResource, TscnScene, ResourceNeededCallback } from '../parser/types';
import type { FileEventBus } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';
import { ResourceEventBus } from './ResourceEventBus';
import { MetadataStore } from './MetadataStore';
import { createTextureProcessor } from './processors/createTextureProcessor';
import { createMaterialProcessor } from './processors/createMaterialProcessor';
import { createGLBProcessor } from './processors/createGLBProcessor';
import { parseReference } from './processing/materialProcessing';
import type { ResourceProcessor } from './createResourceProcessor';
import { SceneLoader } from './loaders/SceneLoader';
import * as logger from '../logger';

export class ResourceLoader {
  readonly metadata: MetadataStore;
  readonly eventBus: ResourceEventBus;
  readonly textures: ResourceProcessor<THREE.Texture>;
  readonly materials: ResourceProcessor<THREE.Material>;
  readonly glbMeshes: ResourceProcessor<THREE.Object3D>;

  // Scene loading uses SceneLoader internally (supports provider-based loading)
  private sceneLoader: SceneLoader;

  private provider: ResourceProvider | null = null;
  private onResourceNeeded: ResourceNeededCallback | null = null;

  private _fileEventBus: FileEventBus | null;

  constructor(fileEventBus?: FileEventBus) {
    this._fileEventBus = fileEventBus || null;
    this.eventBus = new ResourceEventBus();
    this.metadata = new MetadataStore();

    // Create texture processor first (materials need it)
    // Note: If no fileEventBus, processors won't receive file events
    this.textures = createTextureProcessor(fileEventBus, this.eventBus);

    // Create texture loader function for materials
    const loadTexture = async (id: string): Promise<THREE.Texture | null> => {
      const cached = this.textures.getCached(id);
      if (cached !== undefined) return cached;

      this.textures.request(id);
      try {
        return await this.eventBus.once<THREE.Texture>('texture', 'loaded', id);
      } catch {
        return null;
      }
    };

    // Create other processors
    this.materials = createMaterialProcessor(fileEventBus, this.eventBus, loadTexture);
    this.glbMeshes = createGLBProcessor(fileEventBus, this.eventBus);

    // Create scene loader (uses provider-based loading)
    this.sceneLoader = new SceneLoader(this.eventBus, null);

    // Wire up onResourceNeeded callbacks for failed events
    this.setupFailureCallbacks();
  }

  private setupFailureCallbacks(): void {
    const resourceTypes: Array<{ type: 'texture' | 'material' | 'scene' | 'glb'; label: string }> = [
      { type: 'texture', label: 'Material using texture' },
      { type: 'material', label: 'Node using material' },
      { type: 'scene', label: 'Node instance of scene' },
      { type: 'glb', label: 'Node using GLB mesh' },
    ];

    for (const { type, label } of resourceTypes) {
      this.eventBus.on<Error>(type, 'failed', (pathOrId, error) => {
        if (this.onResourceNeeded) {
          const resource = this.metadata.get(pathOrId);
          if (resource) {
            // Use the original resource ID for referencedBy, not the path
            const resourceId = resource.id;
            const result = this.onResourceNeeded({
              path: resource.path,
              type: resource.type,
              referencedBy: `${label} ${resourceId}`,
              error: error?.message || 'Unknown error',
            });
            if (result && typeof result.catch === 'function') {
              result.catch((err) => {
                logger.error(`[ResourceLoader] onResourceNeeded callback failed:`, err);
              });
            }
          }
        }
      });
    }
  }

  /**
   * Register an external resource from parsed TSCN data.
   */
  register(resource: ExtResource): void {
    this.metadata.register(resource);
    // Register PackedScene resources with SceneLoader for provider-based loading
    if (resource.type === 'PackedScene') {
      this.sceneLoader.registerMetadata(resource.id, resource);
    }
  }

  /**
   * Set the resource provider (for scene loading via SceneLoader).
   */
  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
    this.sceneLoader.setProvider(provider);
  }

  /**
   * Get the resource provider.
   */
  getProvider(): ResourceProvider | null {
    return this.provider;
  }

  /**
   * Get the resource event bus for event-based loading.
   */
  getEventBus(): ResourceEventBus {
    return this.eventBus;
  }

  /**
   * Set callback for when a resource is needed but not available.
   */
  setOnResourceNeeded(callback: ResourceNeededCallback): void {
    this.onResourceNeeded = callback;
  }

  /**
   * Request a texture to be loaded (non-blocking, event-based).
   */
  requestTexture(idOrPath: string): void {
    this.textures.request(idOrPath);
  }

  /**
   * Request a material to be loaded (non-blocking, event-based).
   */
  requestMaterial(idOrPath: string): void {
    this.materials.request(idOrPath);
  }

  /**
   * Request a scene to be loaded (non-blocking, event-based).
   */
  requestScene(idOrPath: string): void {
    this.sceneLoader.request(idOrPath);
  }

  /**
   * Get cached scene (may be null if load failed, undefined if not cached).
   */
  getSceneCached(idOrPath: string): TscnScene | null | undefined {
    return this.sceneLoader.getCached(idOrPath);
  }

  /**
   * Resolve idOrPath to actual path using metadata.
   */
  resolvePath(idOrPath: string): string {
    const resource = this.metadata.get(idOrPath);
    return resource?.path || idOrPath;
  }

  /**
   * Get resource metadata by ID or path.
   */
  getMetadata(idOrPath: string): ExtResource | undefined {
    return this.metadata.get(idOrPath);
  }

  /**
   * Check if a resource exists in the registry.
   */
  hasResource(idOrPath: string): boolean {
    return this.metadata.has(idOrPath);
  }

  /**
   * Parse ExtResource("id") reference and return the ID.
   */
  static parseReference(value: string): string | null {
    return parseReference(value);
  }

  /**
   * Resolve instance reference to scene path.
   */
  resolveInstancePath(instanceRef: string | undefined): string | null {
    if (!instanceRef) return null;

    const resourceId = parseReference(instanceRef);
    if (!resourceId) {
      logger.warn(`[ResourceLoader] Invalid instance reference format: ${instanceRef}`);
      return null;
    }

    const metadata = this.metadata.get(resourceId);
    if (!metadata) {
      logger.warn(`[ResourceLoader] Instance resource not found: ${resourceId}`);
      return null;
    }

    if (metadata.type !== 'PackedScene') {
      logger.warn(
        `[ResourceLoader] Instance resource is not a PackedScene: ${resourceId} ` +
        `(type: ${metadata.type})`
      );
      return null;
    }

    return metadata.path;
  }

  /**
   * Clear all caches and metadata.
   */
  clear(): void {
    this.metadata.clear();
    this.textures.clearCache();
    this.materials.clearCache();
    this.sceneLoader.clearAllCache();
    this.glbMeshes.clearCache();
    this.eventBus.clear();
    logger.info('[ResourceLoader] Cleared all caches');
  }

  /**
   * Clear cache for a specific path across all processors.
   * Used for hot-reload scenarios.
   */
  clearCache(path: string): void {
    this.textures.clearCache(path);
    this.materials.clearCache(path);
    this.sceneLoader.clearCache(path);
    this.glbMeshes.clearCache(path);
    logger.info(`[ResourceLoader] Cleared cache for: ${path}`);
  }

  /**
   * Clear specific resource type caches.
   */
  clearTextureCache(id?: string): void {
    this.textures.clearCache(id);
  }

  clearMaterialCache(id?: string): void {
    this.materials.clearCache(id);
  }

  clearSceneCache(id?: string): void {
    if (id) {
      this.sceneLoader.clearCache(id);
    } else {
      this.sceneLoader.clearAllCache();
    }
  }

  clearGLBMeshCache(id?: string): void {
    this.glbMeshes.clearCache(id);
  }

  /**
   * Clear texture cache for all textures referencing a specific path.
   * Note: With path-based caching in processors, this clears the path entry directly.
   */
  clearTextureCacheByPath(path: string): void {
    this.textures.clearCache(path);
  }

  /**
   * Clear material cache for all materials referencing a specific path.
   * Note: With path-based caching in processors, this clears the path entry directly.
   */
  clearMaterialCacheByPath(path: string): void {
    this.materials.clearCache(path);
  }
}
