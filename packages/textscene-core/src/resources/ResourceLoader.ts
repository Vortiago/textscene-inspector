/**
 * Event-based resource loader: one `createResourceProcessor` per resource type, so
 * a new type registers a processor, not new methods here. A caller that knows the
 * type uses a named accessor (`loader.textures`), a data-driven one `request(type, path)`.
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
import { createTresResourceProcessor } from './processors/createTresResourceProcessor';
import { createArrayMeshProcessor, type ArrayMeshResource } from './processors/createArrayMeshProcessor';
import { createFontProcessor } from './processors/createFontProcessor';
import { createThemeProcessor } from './processors/createThemeProcessor';
import { runClearCachesSequence } from './clearCachesSequence';
import { resourceFilePath } from './subResourcePath';
import type { FontResource } from './fonts/font/types';
import type { ThemeResource } from './styles/theme/types';
import { resourceSliceRegistry } from './sliceRegistration';
import './sliceRegistrations.js';
import type { ParsedResource } from '../parser/parsedResource';
import { PEER_LOAD_TIMEOUT_MS, type ResourceProcessor } from './createResourceProcessor';
import * as logger from '../logger';

/**
 * The bus tag a TSCN resource type routes to, from the slice claim table (ADR-0031),
 * never by name sniffing. Null means an unclaimed type, or a claimed one the loader
 * never serves (ViewportTexture resolves by NodePath): `provideFile` tells them apart
 * with `byTypeName`. Exported so the test fake mirrors the same routing.
 */
export function busTypeFor(resourceType: string | undefined): ResourceType | null {
  if (!resourceType) return null;
  return resourceSliceRegistry.busTypeFor(resourceType);
}

export class ResourceLoader {
  readonly metadata: MetadataStore;
  readonly eventBus: ResourceEventBus;
  readonly textures: ResourceProcessor<THREE.Texture>;
  readonly materials: ResourceProcessor<THREE.Material>;
  readonly glbMeshes: ResourceProcessor<THREE.Object3D>;
  readonly scenes: ResourceProcessor<TscnScene>;
  /** Generic .tres files (TileSet) parsed as ParsedResource. */
  readonly resources: ResourceProcessor<ParsedResource>;
  /** ArrayMesh .tres decoded into geometry + per-surface material paths. */
  readonly arrayMeshes: ResourceProcessor<ArrayMeshResource>;
  /** FontFile/SystemFont/FontVariation, recursively resolved (base_font, fallbacks). */
  readonly fonts: ResourceProcessor<FontResource>;
  /** Theme .tres, font-relevant fields resolved (default_font, <Type>/fonts/<name>); everything else raw. */
  readonly themes: ResourceProcessor<ThemeResource>;

  /** Type to processor. The named accessors above are entries of this map, so routing needs no per-type switch. */
  private readonly processors: Map<ResourceType, ResourceProcessor<unknown>>;

  private provider: ResourceProvider | null = null;
  private onResourceNeeded: ResourceNeededCallback | null = null;

  private _fileEventBus: FileEventBus | null;

  /**
   * How many mounted `useResource` consumers are still waiting: the signal that
   * loading has finished, which a timer can only guess at. It lives here, not in a
   * context of its own, so no host mounts another provider.
   */
  private pendingResources = 0;
  private readonly pendingListeners = new Set<() => void>();

  /** Called by `useResource` while a consumer is pending; returns the release. */
  beginPending(): () => void {
    this.pendingResources += 1;
    this.notifyPending();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.pendingResources -= 1;
      this.notifyPending();
    };
  }

  get pendingResourceCount(): number {
    return this.pendingResources;
  }

  /** Subscribe to pending-count changes; returns the unsubscribe. */
  subscribePending(listener: () => void): () => void {
    this.pendingListeners.add(listener);
    return () => this.pendingListeners.delete(listener);
  }

  private notifyPending(): void {
    for (const listener of this.pendingListeners) listener();
  }

  /**
   * Await a peer processor's resource: answer from cache, else request it and wait on
   * that processor's bus slot. Bounded, because a processor whose `shouldProcess` refuses
   * the bytes settles nothing, and an unbounded await would wedge the caller (a GLB would
   * never appear nor report missing). The ceiling is far above any real fetch.
   */
  private async peerLoad<T>(
    processor: ResourceProcessor<T>,
    busType: ResourceType,
    path: string
  ): Promise<T | null> {
    const cached = processor.getCached(path);
    if (cached !== undefined) return cached;
    processor.request(path);
    try {
      return await this.eventBus.once<T>(busType, 'loaded', path, PEER_LOAD_TIMEOUT_MS);
    } catch {
      return null;
    }
  }

  constructor(fileEventBus?: FileEventBus) {
    this._fileEventBus = fileEventBus || null;
    this.eventBus = new ResourceEventBus();
    this.metadata = new MetadataStore();

    // Texture processor first: materials need it for inline texture refs.
    this.textures = createTextureProcessor(fileEventBus, this.eventBus);

    const loadTexture = (path: string): Promise<THREE.Texture | null> =>
      this.peerLoad(this.textures, 'texture', path);

    this.materials = createMaterialProcessor(fileEventBus, this.eventBus, loadTexture);

    // A GLB's **Import sidecar** can repoint a glTF material at an external `.tres`,
    // which resolves through the material processor.
    this.glbMeshes = createGLBProcessor(fileEventBus, this.eventBus, (path) =>
      this.peerLoad(this.materials, 'material', path)
    );

    // PackedScene loads directly (`loadDirectly`). The id-to-path translation reads the
    // shared MetadataStore.
    this.scenes = createSceneProcessor({
      eventBus: this.eventBus,
      resolveMetadata: (idOrPath) => {
        const meta = this.metadata.get(idOrPath);
        if (meta) return { path: meta.path, type: meta.type };
        // A raw `res://` `instance` names no ExtResource, so nothing registers
        // it: the address is its own path, and its type is unknown.
        return idOrPath.startsWith('res://') ? { path: idOrPath, type: null } : null;
      },
      getProvider: () => this.provider,
    });

    this.resources = createTresResourceProcessor(fileEventBus, this.eventBus);
    this.arrayMeshes = createArrayMeshProcessor(fileEventBus, this.eventBus);
    this.fonts = createFontProcessor(fileEventBus, this.eventBus);

    // A Theme's font refs resolve through the FONT processor (a different peer, unlike a
    // Font's own self-recursion).
    this.themes = createThemeProcessor(fileEventBus, this.eventBus, (address) =>
      this.peerLoad(this.fonts, 'font', address)
    );

    this.processors = new Map<ResourceType, ResourceProcessor<unknown>>([
      ['texture', this.textures as ResourceProcessor<unknown>],
      ['material', this.materials as ResourceProcessor<unknown>],
      ['glb', this.glbMeshes as ResourceProcessor<unknown>],
      ['scene', this.scenes as ResourceProcessor<unknown>],
      ['resource', this.resources as ResourceProcessor<unknown>],
      ['arraymesh', this.arrayMeshes as ResourceProcessor<unknown>],
      ['font', this.fonts as ResourceProcessor<unknown>],
      ['theme', this.themes as ResourceProcessor<unknown>],
    ]);

    this.setupFailureCallbacks();
  }

  /**
   * The byte layer, for a file found by convention rather than declared by a scene
   * (`project.godot`, an `.import` sidecar), read with `tryLoad`, whose miss is an
   * ordinary answer, not a **Missing resource**. What a scene names goes through a processor.
   */
  get fileEventBus(): FileEventBus | null {
    return this._fileEventBus;
  }

  private setupFailureCallbacks(): void {
    const labels: Record<ResourceType, string> = {
      texture: 'Material using texture',
      material: 'Node using material',
      scene: 'Node instance of scene',
      glb: 'Node using GLB mesh',
      resource: 'Resource',
      arraymesh: 'Node using ArrayMesh',
      font: 'Node using font',
      theme: 'Node using theme',
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
  }

  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
  }

  getProvider(): ResourceProvider | null {
    return this.provider;
  }

  setOnResourceNeeded(callback: ResourceNeededCallback): void {
    this.onResourceNeeded = callback;
  }

  /** The processor serving `type`, for a consumer that reads, requests and pins by path. */
  processor<T>(type: ResourceType): ResourceProcessor<T> | undefined {
    return this.processors.get(type) as ResourceProcessor<T> | undefined;
  }

  /** Request a resource through the processor for `type`. */
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

  /**
   * Clear all caches, metadata and caller subscribers, and announce no `invalidated`,
   * since no subscriber is left to hear it. `eventBus.clear()` also drops the loader's
   * own failure callbacks, so they are re-subscribed: without them `onResourceNeeded`
   * would go silent for the rest of the loader's life.
   */
  clear(): void {
    this.metadata.clear();
    for (const proc of this.processors.values()) {
      proc.clearCache();
    }
    this.eventBus.clear();
    this.setupFailureCallbacks();
    logger.info('[ResourceLoader] Cleared all caches');
  }

  /**
   * Drop every cached resource, file byte and metadata entry, but keep subscribers,
   * for a switch to a corpus whose res:// paths would alias the old one's cache.
   * The host repoints the provider first and calls this only after the old scene is
   * torn down: announced consumers refetch at once under the current provider.
   */
  clearCaches(): void {
    runClearCachesSequence({
      processors: this.processors,
      eventBus: this.eventBus,
      metadata: this.metadata,
      clearFileBus: () => this._fileEventBus?.clearCache(),
      log: () => logger.info('[ResourceLoader] Cleared caches (subscribers kept)'),
    });
  }

  /** Clear one path across all processors (hot-reload). `provideFile` also drops the FileEventBus cache. */
  clearCache(path: string): void {
    for (const proc of this.processors.values()) {
      proc.clearCache(path);
    }
    logger.info(`[ResourceLoader] Cleared cache for: ${path}`);
  }

  /**
   * Signal that a missing file is now available: clear its cached failure and
   * re-request it, so `useResource` moves from `'missing'` to `'loaded'`. The
   * registered metadata type picks the processor. An unregistered path fans out
   * to every processor that could claim it.
   */
  provideFile(rawPath: string): void {
    // Bytes belong to a file, so normalise first: clearing the file announces
    // `invalidated` to every address inside it, while an address would miss the
    // metadata. This backstops an out-of-tree host that passes a sub-resource address.
    const path = resourceFilePath(rawPath);
    this._fileEventBus?.clearCache(path);
    this.clearCache(path);

    const metadata = this.metadata.get(path);
    const registration = metadata?.type ? resourceSliceRegistry.byTypeName(metadata.type) : null;
    const busType = registration?.busType ?? null;

    logger.info(
      `[ResourceLoader] provideFile: ${path}` +
        (metadata?.type ? ` (type: ${metadata.type})` : ' (no metadata; fanning out)')
    );

    if (busType) {
      this.request(busType, path);
    } else if (registration) {
      // A claimed type the loader never serves (ViewportTexture): fanning out would
      // ask processors that must refuse it.
      logger.info(`[ResourceLoader] provideFile: ${metadata?.type} is not loader-served; skipping`);
    } else if (path.endsWith('.tres')) {
      // Unregistered .tres, such as a raw `tile_set` path: every .tres processor gets
      // the re-request, and each subscriber hears only its own bus slot.
      this.materials.request(path);
      this.resources.request(path);
      this.fonts.request(path);
      this.themes.request(path);
    } else {
      // Unknown type: only the processor that can read the content produces a result.
      // The other fails silently into its cache, unseen by subscribers of its bus slot.
      this.textures.request(path);
      this.materials.request(path);
    }
  }
}
