/**
 * Event-based resource loader.
 *
 * There used to be three implementations of the same
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
 *     `clearCache(path?)`. Use when the type is data-driven
 *     (e.g. `provideFile` routing). Callers that statically know the type
 *     use the named processor accessors directly (`loader.textures.request`).
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
import type { ResourceProcessor } from './createResourceProcessor';
import * as logger from '../logger';

/**
 * The bus tag a TSCN resource-type string routes to, answered by the slice
 * claim table (ADR-0031) — never by name sniffing. Null means either a type
 * no slice claims, or a claimed type the loader never serves (ViewportTexture
 * resolves by NodePath); `provideFile` tells the two apart via `byTypeName`.
 * Exported so the test fake mirrors the same routing.
 */
export function busTypeFor(resourceType: string | undefined): ResourceType | null {
  if (!resourceType) return null;
  return resourceSliceRegistry.busTypeFor(resourceType);
}

/** Ceiling on a peer-processor wait — see `ResourceLoader.peerLoad`. */
const PEER_LOAD_TIMEOUT_MS = 30_000;

export class ResourceLoader {
  readonly metadata: MetadataStore;
  readonly eventBus: ResourceEventBus;
  readonly textures: ResourceProcessor<THREE.Texture>;
  readonly materials: ResourceProcessor<THREE.Material>;
  readonly glbMeshes: ResourceProcessor<THREE.Object3D>;
  readonly scenes: ResourceProcessor<TscnScene>;
  /** Generic .tres files (currently TileSet) parsed as ParsedResource. */
  readonly resources: ResourceProcessor<ParsedResource>;
  /** ArrayMesh .tres decoded into geometry + per-surface material paths. */
  readonly arrayMeshes: ResourceProcessor<ArrayMeshResource>;
  /** FontFile/SystemFont/FontVariation, recursively resolved (base_font, fallbacks). */
  readonly fonts: ResourceProcessor<FontResource>;
  /** Theme .tres, font-relevant fields resolved (default_font, <Type>/fonts/<name>); everything else raw. */
  readonly themes: ResourceProcessor<ThemeResource>;

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

  /**
   * How many mounted `useResource` consumers are still waiting. Lives here
   * rather than in a context of its own so no host has to mount another
   * provider — every consumer already reaches the loader.
   *
   * The point is a signal for "loading has actually finished", which a timer
   * can only guess at: a scene whose meshes are big external `.tres` files
   * settles long after one whose geometry is inline.
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
   * Await a peer processor's resource — the one shape every cross-processor dependency
   * uses: answer from cache, else request it and wait on that processor's bus slot.
   *
   * BOUNDED on purpose. A processor whose `shouldProcess` refuses bytes it was asked for
   * settles nothing at all — by design, since the byte layer broadcasts one file to every
   * processor and expects a sibling to claim it — so an unbounded await would wedge the
   * caller for the session. One caller is the GLB template's own load, where that means
   * the asset never appears and never reports missing. The ceiling is far above any real
   * fetch, so it only ever fires on that silence.
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

    // Texture processor first — materials need it for inline texture refs.
    this.textures = createTextureProcessor(fileEventBus, this.eventBus);

    const loadTexture = (path: string): Promise<THREE.Texture | null> =>
      this.peerLoad(this.textures, 'texture', path);

    this.materials = createMaterialProcessor(fileEventBus, this.eventBus, loadTexture);

    // A GLB's **Import sidecar** can repoint a glTF material at an external `.tres`,
    // which resolves through the MATERIAL processor.
    this.glbMeshes = createGLBProcessor(fileEventBus, this.eventBus, (path) =>
      this.peerLoad(this.materials, 'material', path)
    );

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
   * The byte layer, for callers that read a file found by CONVENTION rather
   * than declared by a scene — `project.godot`, an `.import` sidecar — via
   * `tryLoad`, whose miss is an ordinary answer instead of a **Missing
   * resource**. Everything a scene names goes through a processor instead.
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

  setOnResourceNeeded(callback: ResourceNeededCallback): void {
    this.onResourceNeeded = callback;
  }

  // ---- Type-generic surface ------------------------------------------------

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

  // ---- Cache management ----------------------------------------------------

  /**
   * Clear all caches, metadata, and event subscribers.
   *
   * `eventBus.clear()` wipes EVERY subscriber, including the loader's
   * own `setupFailureCallbacks` subscriptions — without re-registering them,
   * calling `clear()` on a live loader would permanently silence the
   * missing-resources reporting (`onResourceNeeded`) for the rest of that
   * loader's lifetime, with no error or warning to say so. Re-subscribing
   * here keeps `clear()` safe to call at any point; it only drops CALLER
   * subscribers (matching the doc below), never the loader's own plumbing.
   * Teardown semantics — no `invalidated` announcements: subscribers are
   * being dropped, so there is no audience by construction.
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
   * Drop every cached resource, raw file byte cache, and metadata entry but
   * KEEP event subscribers (including the loader's own failure callbacks).
   * Used when the active scene switches to a different vendored corpus whose
   * res:// namespace would otherwise alias the previous corpus's cache
   * entries (two demos both referencing e.g. `res://art/player.png`).
   *
   * The clear→announce→metadata-last choreography lives in
   * `runClearCachesSequence` (shared with the test fake — order is the
   * contract; see that module for the full rationale). PRECONDITION for hosts:
   * repoint the provider / URL modifier BEFORE calling this, and call it only
   * once the outgoing corpus's scene is torn down — announced consumers refetch
   * immediately under whatever provider state is current, so any still mounted
   * would pull their own res:// paths out of the incoming corpus (the web
   * host's `applyCorpusRoot` is called at the scene swap for exactly this).
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
  provideFile(rawPath: string): void {
    // Bytes only ever belong to a FILE, so normalise before anything keys off
    // this: clearing the file is what announces `invalidated` to every address
    // inside it, while routing an address would miss the metadata and fan out to
    // the wrong processors. `MissingResourcesPanel` already hands its host a
    // file, so no in-repo caller needs this — it is the public-API backstop for
    // an out-of-tree host that passes a row's identity straight through, not a
    // second opinion about where that boundary lives.
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
      // A claimed type the loader never serves (busType null, e.g.
      // ViewportTexture): nothing to re-request, and fanning out would ask
      // processors that must refuse it.
      logger.info(`[ResourceLoader] provideFile: ${metadata?.type} is not loader-served; skipping`);
    } else if (path.endsWith('.tres')) {
      // Unregistered .tres — a raw `res://…tres` reference (e.g. a
      // `tile_set` path with no ExtResource declaration). Every .tres
      // processor gets the re-request; subscribers listen on their own
      // bus slot, so only the relevant one is observed.
      this.materials.request(path);
      this.resources.request(path);
      this.fonts.request(path);
      this.themes.request(path);
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
}
