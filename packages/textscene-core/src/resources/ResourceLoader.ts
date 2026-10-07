/**
 * Event-based resource loader: one `createResourceProcessor` per resource type, so
 * a new type registers a processor, not new methods here. A caller that knows the
 * type uses a named accessor (`loader.textures`), a data-driven one `request(type, path)`.
 */

import * as THREE from 'three';
import type { ExtResource, TscnScene } from '../parser/types';
import type { FileData, FileEventBus } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';
import { ResourceEventBus, type ResourceType } from './ResourceEventBus';
import { MetadataStore } from './MetadataStore';
import { createTextureProcessor } from './processors/createTextureProcessor';
import { createGLBProcessor } from './processors/createGLBProcessor';
import { createSceneProcessor } from './processors/createSceneProcessor';
import { createTresResourceProcessor } from './processors/createTresResourceProcessor';
import { createArrayMeshProcessor, type ArrayMeshResource } from './processors/createArrayMeshProcessor';
import { createFontProcessor } from './processors/createFontProcessor';
import { createThemeProcessor } from './processors/createThemeProcessor';
import { runClearCachesSequence } from './clearCachesSequence';
import { runProvideFileSequence } from './provideFileSequence';
import type { FontResource } from './fonts/font/types';
import type { GltfExtensionRules } from './formats/glb/types';
import type { ThemeResource } from './styles/theme/types';
import './sliceRegistrations.js';
import type { ParsedResource } from '../parser/parsedResource';
import { PEER_LOAD_TIMEOUT_MS, type ResourceProcessor } from './createResourceProcessor';
import { DependencyGraph, type Dependent } from './dependencyGraph';
import type { ParsedFileLoaderFn } from './resourceSection';
import { resourceFilePath } from './subResourcePath';
import * as logger from '../logger';
import { WorkerJobRunner, type CreateJobWorker } from '../workers/WorkerJobRunner';

export interface ResourceLoaderOptions {
  /** Which glTF extensions a GLB loads with. Absent means `createGLBMesh`'s default. */
  gltfExtensions?: GltfExtensionRules;
  /** Starts the host's job worker. Without it, jobs run on the main thread. */
  createWorker?: CreateJobWorker;
}

export class ResourceLoader {
  readonly metadata: MetadataStore;
  /** Which cached resources read which files, so a **Dependency hot-reload** reaches them. */
  private readonly dependencies = new DependencyGraph();
  /** Runs procedural texture builds, in the host's worker where it has one. */
  readonly jobRunner: WorkerJobRunner;
  readonly eventBus: ResourceEventBus;
  readonly textures: ResourceProcessor<THREE.Texture>;
  readonly glbMeshes: ResourceProcessor<THREE.Object3D>;
  readonly scenes: ResourceProcessor<TscnScene>;
  /** Each `.tres` parsed once: the parse every slice that decodes Godot text reads. */
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
   * Await a peer processor's resource for `dependent`: answer from cache, else request
   * it and wait on that processor's bus slot. Rejects with the peer's failure. Bounded,
   * far above any real fetch: a processor whose `shouldProcess` refuses the bytes settles
   * nothing, and an unbounded await would leave a GLB that never appears nor reports missing.
   */
  private async peerRequire<T>(
    dependent: Dependent,
    processor: ResourceProcessor<T>,
    busType: ResourceType,
    path: string
  ): Promise<T> {
    // First, so a change to `path` reloads `dependent` whether this read hits, fails or waits.
    this.dependencies.record(dependent, path);
    const cached = processor.getCached(path);
    if (cached === null) throw new Error(`${busType} ${path} previously failed to load`);
    if (cached !== undefined) return cached;
    processor.request(path);
    return this.eventBus.once<T>(busType, 'loaded', path, PEER_LOAD_TIMEOUT_MS);
  }

  /** {@link peerRequire}, with null for a peer that failed or never answered. */
  private async peerLoad<T>(
    dependent: Dependent,
    processor: ResourceProcessor<T>,
    busType: ResourceType,
    path: string
  ): Promise<T | null> {
    try {
      return await this.peerRequire(dependent, processor, busType, path);
    } catch {
      return null;
    }
  }

  /**
   * A file's bytes for a processor that routes by path before it fetches. No handler
   * hears the read, and the byte cache lets its copy go: the caller keeps what it builds.
   */
  private async readFile(path: string, type: string): Promise<FileData> {
    const fileBus = this._fileEventBus;
    if (!fileBus) throw new Error(`No file bus to read ${path}`);
    const data = await fileBus.tryLoad(path, type);
    fileBus.clearCache(path);
    if (data === null) throw new Error(`File not found: ${path}`);
    return data;
  }

  /** The parsed file behind each address `busType` loads, from the `resource` slot's cache. */
  private parsedFileLoaderFor(busType: ResourceType): ParsedFileLoaderFn {
    return (path) =>
      this.peerRequire({ busType, key: path }, this.resources, 'resource', resourceFilePath(path));
  }

  constructor(fileEventBus?: FileEventBus, options: ResourceLoaderOptions = {}) {
    this._fileEventBus = fileEventBus || null;
    this.jobRunner = new WorkerJobRunner({ createWorker: options.createWorker });
    this.eventBus = new ResourceEventBus();
    this.metadata = new MetadataStore();

    this.textures = createTextureProcessor(fileEventBus, this.eventBus);

    // A GLB's **Import sidecar** can repoint a glTF material at an external `.tres`. The
    // processor tags the surface, and the scene root draws that `.tres` like any material.
    this.glbMeshes = createGLBProcessor(
      fileEventBus,
      this.eventBus,
      this.dependencies,
      options.gltfExtensions
    );

    // PackedScene loads directly (`loadDirectly`). The id-to-path translation reads the
    // shared MetadataStore.
    this.scenes = createSceneProcessor({
      eventBus: this.eventBus,
      resolveMetadata: (idOrPath) => {
        const meta = this.metadata.get(idOrPath);
        if (meta) return { path: meta.path, type: meta.type };
        // A raw `res://` `instance` names no ExtResource, so nothing registers
        // it: the address is its own path, and its type is unknown. Callers request
        // the simplified address (`resolveInstancePath`), the processor's cache key.
        return idOrPath.startsWith('res://') ? { path: idOrPath, type: null } : null;
      },
      getProvider: () => this.provider,
    });

    this.resources = createTresResourceProcessor(fileEventBus, this.eventBus);
    this.arrayMeshes = createArrayMeshProcessor(this.eventBus, this.parsedFileLoaderFor('arraymesh'));
    this.fonts = createFontProcessor(
      this.eventBus,
      this.parsedFileLoaderFor('font'),
      (path) => this.readFile(path, 'FontFile'),
      this.dependencies
    );

    // A Theme's font refs resolve through the FONT processor (a different peer, unlike a
    // Font's own self-recursion).
    this.themes = createThemeProcessor(
      this.eventBus,
      this.parsedFileLoaderFor('theme'),
      (themeKey) => (address) =>
        this.peerLoad({ busType: 'theme', key: themeKey }, this.fonts, 'font', address)
    );

    this.processors = new Map<ResourceType, ResourceProcessor<unknown>>([
      ['texture', this.textures as ResourceProcessor<unknown>],
      ['glb', this.glbMeshes as ResourceProcessor<unknown>],
      ['scene', this.scenes as ResourceProcessor<unknown>],
      ['resource', this.resources as ResourceProcessor<unknown>],
      ['arraymesh', this.arrayMeshes as ResourceProcessor<unknown>],
      ['font', this.fonts as ResourceProcessor<unknown>],
      ['theme', this.themes as ResourceProcessor<unknown>],
    ]);
  }

  /**
   * The byte layer, for a file found by convention rather than declared by a scene
   * (`project.godot`, an `.import` sidecar), read with `tryLoad`, whose miss is an
   * ordinary answer, not a **Missing resource**. What a scene names goes through a processor.
   */
  get fileEventBus(): FileEventBus | null {
    return this._fileEventBus;
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

  getMetadata(idOrPath: string): ExtResource | undefined {
    return this.metadata.get(idOrPath);
  }

  /**
   * Clear all caches, metadata and subscribers, and announce no `invalidated`,
   * since no subscriber is left to hear it.
   */
  clear(): void {
    this.metadata.clear();
    this.dependencies.clear();
    for (const proc of this.processors.values()) {
      proc.clearCache();
    }
    this.eventBus.clear();
    logger.info('[ResourceLoader] Cleared all caches');
  }

  /**
   * Drop every cached resource, file byte and metadata entry, but keep subscribers,
   * for a switch to a corpus whose res:// paths would alias the old one's cache.
   * The host repoints the provider first and calls this only after the old scene is
   * torn down: announced consumers refetch at once under the current provider.
   */
  clearCaches(): void {
    this.dependencies.clear();
    runClearCachesSequence({
      processors: this.processors,
      eventBus: this.eventBus,
      metadata: this.metadata,
      clearFileBus: () => this._fileEventBus?.clearCache(),
      log: () => logger.info('[ResourceLoader] Cleared caches (subscribers kept)'),
    });
  }

  /**
   * A file changed, appeared or went away (a **Dependency hot-reload**, a **Resource
   * upload** or its removal): drop and announce every resource built from it or that
   * read it. A mounted consumer requests each again. An address names its whole file.
   */
  provideFile(path: string): void {
    logger.info(`[ResourceLoader] provideFile: ${path}`);
    runProvideFileSequence({
      path,
      processors: this.processors,
      fileBus: this._fileEventBus ?? undefined,
      dependencies: this.dependencies,
    });
  }
}
