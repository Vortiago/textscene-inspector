/**
 * Event-based resource loader.
 *
 * **WI-ARCH-2**: there used to be three implementations of the same
 * cache/inflight/event-emission loop — this file, `loaders/SceneLoader.ts`,
 * and `createResourceProcessor.ts`. The standalone `SceneLoader` class is
 * gone; PackedScene now flows through the same `createResourceProcessor`
 * factory as textures/materials/GLBs (see `processors/createSceneProcessor.ts`).
 * The owning ResourceLoader keeps a single `processors` map keyed by
 * resource type — adding a new type means registering one more
 * processor, not adding fields + methods to this class.
 *
 * Public surface:
 *
 *   - Named processor accessors: `loader.textures`, `loader.materials`,
 *     `loader.glbMeshes`, `loader.scenes`. Each implements
 *     `ResourceProcessor<T>` — `request(path)`, `getCached(path)`,
 *     `isCached(path)`, `isLoading(path)`, `clearCache(path?)`,
 *     `getCacheSize()`. Use these when you statically know the type.
 *
 *   - Type-generic surface: `request(type, path)`, `getCached(type, path)`,
 *     `clearCache(path?, type?)`. Use when the type is data-driven
 *     (e.g. `provideFile` routing).
 *
 *   - Per-type pass-through methods (`requestTexture`, `requestScene`,
 *     `getSceneCached`, `clearTextureCache`, etc.) are 1-line shims
 *     delegating to the appropriate processor. Retained for
 *     compatibility with existing call sites (`useResource.ts` and
 *     the node-component test mocks); the underlying machine is
 *     unified.
 *
 *   - `provideFile(path)`: clear caches for the path and re-route
 *     through the right processor for the registered metadata type.
 *     The signature is intentionally **type-agnostic** — see
 *     `setupFailureCallbacks`.
 */

import * as THREE from 'three';
import type { ExtResource, TscnScene, ResourceNeededCallback } from '../parser/types';
import type { FileEventBus } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';
import { ResourceEventBus, type ResourceType } from './ResourceEventBus';
import { MetadataStore } from './MetadataStore';
import { createTextureProcessor } from './processors/createTextureProcessor';
import { createMaterialProcessor } from './processors/createMaterialProcessor';
import { createGLBProcessor } from './processors/createGLBProcessor';
import { createSceneProcessor } from './processors/createSceneProcessor';
import { parseReference } from './processing/materialProcessing';
import type { ResourceProcessor } from './createResourceProcessor';
import * as logger from '../logger';

/**
 * Returns the canonical ResourceType bus tag for a TSCN resource-type
 * string. PackedScene → 'scene', StandardMaterial3D → 'material', etc.
 * Used by `provideFile` to route a re-request through the right
 * processor.
 */
function busTypeFor(resourceType: string | undefined): ResourceType | null {
  if (!resourceType) return null;
  if (resourceType.includes('Texture')) return 'texture';
  if (resourceType.includes('Material')) return 'material';
  if (resourceType === 'PackedScene') return 'scene';
  if (resourceType === 'GLB' || resourceType === 'GLTF' || resourceType === 'GLBMesh') return 'glb';
  return null;
}

export class ResourceLoader {
  readonly metadata: MetadataStore;
  readonly eventBus: ResourceEventBus;
  readonly textures: ResourceProcessor<THREE.Texture>;
  readonly materials: ResourceProcessor<THREE.Material>;
  readonly glbMeshes: ResourceProcessor<THREE.Object3D>;
  readonly scenes: ResourceProcessor<TscnScene>;

  /**
   * Type → processor table. The four named accessors above are stable
   * references to entries in this map; iterating the map is how
   * `clear()` / `provideFile()` / the generic `request(type, path)`
   * surface route work without per-type switches.
   */
  private readonly processors: Map<ResourceType, ResourceProcessor<unknown>>;

  private provider: ResourceProvider | null = null;
  private onResourceNeeded: ResourceNeededCallback | null = null;

  private _fileEventBus: FileEventBus | null;

  constructor(fileEventBus?: FileEventBus) {
    this._fileEventBus = fileEventBus || null;
    this.eventBus = new ResourceEventBus();
    this.metadata = new MetadataStore();

    // Texture processor first — materials need it for inline texture refs.
    this.textures = createTextureProcessor(fileEventBus, this.eventBus);

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

    this.materials = createMaterialProcessor(fileEventBus, this.eventBus, loadTexture);
    this.glbMeshes = createGLBProcessor(fileEventBus, this.eventBus);

    // PackedScene processor — the former standalone SceneLoader collapsed
    // into the same machinery via direct-load mode (`createResourceProcessor`'s
    // `loadDirectly` option). The id↔path translation happens here via the
    // shared MetadataStore.
    this.scenes = createSceneProcessor({
      eventBus: this.eventBus,
      resolveMetadata: (idOrPath) => {
        const meta = this.metadata.get(idOrPath);
        return meta ? { path: meta.path, type: meta.type } : null;
      },
      getProvider: () => this.provider,
    });

    this.processors = new Map<ResourceType, ResourceProcessor<unknown>>([
      ['texture', this.textures as ResourceProcessor<unknown>],
      ['material', this.materials as ResourceProcessor<unknown>],
      ['glb', this.glbMeshes as ResourceProcessor<unknown>],
      ['scene', this.scenes as ResourceProcessor<unknown>],
    ]);

    this.setupFailureCallbacks();
  }

  private setupFailureCallbacks(): void {
    const labels: Record<ResourceType, string> = {
      texture: 'Material using texture',
      material: 'Node using material',
      scene: 'Node instance of scene',
      glb: 'Node using GLB mesh',
      resource: 'Resource',
    };

    for (const type of this.processors.keys()) {
      this.eventBus.on<Error>(type, 'failed', (pathOrId, error) => {
        if (!this.onResourceNeeded) return;
        const resource = this.metadata.get(pathOrId);
        if (!resource) return;
        const result = this.onResourceNeeded({
          path: resource.path,
          type: resource.type,
          referencedBy: `${labels[type]} ${resource.id}`,
          error: error?.message || 'Unknown error',
        });
        if (result && typeof result.catch === 'function') {
          result.catch((err) => {
            logger.error(`[ResourceLoader] onResourceNeeded callback failed:`, err);
          });
        }
      });
    }
  }

  /** Register an external resource from parsed TSCN data. */
  register(resource: ExtResource): void {
    this.metadata.register(resource);
    // PackedScene resources need their metadata in the MetadataStore so
    // the scene processor's `resolveMetadata` callback can find them by
    // id. The MetadataStore already does id+path indexing.
  }

  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
  }

  getProvider(): ResourceProvider | null {
    return this.provider;
  }

  getEventBus(): ResourceEventBus {
    return this.eventBus;
  }

  setOnResourceNeeded(callback: ResourceNeededCallback): void {
    this.onResourceNeeded = callback;
  }

  // ---- Type-generic surface (WI-ARCH-2) ------------------------------------

  /** Request a resource through the appropriate processor for `type`. */
  request(type: ResourceType, path: string): void {
    const proc = this.processors.get(type);
    if (!proc) {
      logger.warn(`[ResourceLoader] Unknown resource type: ${type}`);
      return;
    }
    proc.request(path);
  }

  /** Read a cached resource. Returns undefined when never requested. */
  getCached<T>(type: ResourceType, path: string): T | null | undefined {
    const proc = this.processors.get(type);
    if (!proc) return undefined;
    return proc.getCached(path) as T | null | undefined;
  }

  // ---- Per-type pass-throughs (compat) -------------------------------------

  requestTexture(idOrPath: string): void {
    this.textures.request(idOrPath);
  }

  requestMaterial(idOrPath: string): void {
    this.materials.request(idOrPath);
  }

  requestScene(idOrPath: string): void {
    this.scenes.request(idOrPath);
  }

  getSceneCached(idOrPath: string): TscnScene | null | undefined {
    return this.scenes.getCached(idOrPath);
  }

  // ---- Metadata helpers ----------------------------------------------------

  resolvePath(idOrPath: string): string {
    const resource = this.metadata.get(idOrPath);
    return resource?.path || idOrPath;
  }

  getMetadata(idOrPath: string): ExtResource | undefined {
    return this.metadata.get(idOrPath);
  }

  hasResource(idOrPath: string): boolean {
    return this.metadata.has(idOrPath);
  }

  static parseReference(value: string): string | null {
    return parseReference(value);
  }

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

  // ---- Cache management ----------------------------------------------------

  /** Clear all caches, metadata, and event subscribers. */
  clear(): void {
    this.metadata.clear();
    for (const proc of this.processors.values()) {
      proc.clearCache();
    }
    this.eventBus.clear();
    logger.info('[ResourceLoader] Cleared all caches');
  }

  /**
   * Clear cache for a specific path across all processors (hot-reload).
   * Drops the FileEventBus cache too so the next request hits the
   * provider fresh.
   */
  clearCache(path: string): void {
    for (const proc of this.processors.values()) {
      proc.clearCache(path);
    }
    logger.info(`[ResourceLoader] Cleared cache for: ${path}`);
  }

  /**
   * Signal that a previously-missing file is now available from the host.
   * Clears any cached failure entries for this path and re-requests it,
   * which fires fresh `*:loaded` events for subscribers (the late-arrival
   * flow used by `useResource` to transition `'missing' → 'loaded'`).
   *
   * Routes through the correct processor based on the registered metadata
   * type for the path; if the type is unknown we re-request through
   * texture + material processors (the MVS late-arrival cases) so the
   * dispatch is robust to paths that were referenced but never registered
   * as ExtResource.
   */
  provideFile(path: string): void {
    this._fileEventBus?.clearCache(path);
    this.clearCache(path);

    const metadata = this.metadata.get(path);
    const busType = busTypeFor(metadata?.type);

    logger.info(
      `[ResourceLoader] provideFile: ${path}` +
        (metadata?.type ? ` (type: ${metadata.type})` : ' (no metadata; fanning out)')
    );

    if (busType) {
      this.request(busType, path);
    } else {
      // Unknown type — try the two MVS processors. Only the one that
      // can process the file's content will produce a non-null result;
      // the other will fail silently into its cache and won't emit
      // observable side-effects to subscribers since they branch on
      // path + their own type.
      this.textures.request(path);
      this.materials.request(path);
    }
  }

  // ---- Per-type cache helpers (compat) -------------------------------------

  clearTextureCache(id?: string): void {
    this.textures.clearCache(id);
  }

  clearMaterialCache(id?: string): void {
    this.materials.clearCache(id);
  }

  clearSceneCache(id?: string): void {
    this.scenes.clearCache(id);
  }

  clearGLBMeshCache(id?: string): void {
    this.glbMeshes.clearCache(id);
  }

  clearTextureCacheByPath(path: string): void {
    this.textures.clearCache(path);
  }

  clearMaterialCacheByPath(path: string): void {
    this.materials.clearCache(path);
  }
}
