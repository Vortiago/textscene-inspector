/**
 * Test-only fixture: a fake `ResourceLoader` whose cache and events a test drives,
 * with a real `ResourceEventBus` and `MetadataStore` and a Map-backed processor
 * per slot. It never imports `vitest`, and `testing/` is outside the package
 * build, so it never reaches dist or the linter graph.
 */

import * as THREE from 'three';
import type { ParsedResource } from '../../parser/parsedResource';
import type { ExtResource, TscnScene } from '../../parser/types';
import { ResourceEventBus, type ResourceType } from '../ResourceEventBus';
import { MetadataStore } from '../MetadataStore';
import { busTypeFor, type ResourceLoader } from '../ResourceLoader';
import { runClearCachesSequence } from '../clearCachesSequence';
import type { ArrayMeshResource } from '../processors/createArrayMeshProcessor';
import type { FontResource } from '../fonts/font/types';
import type { ThemeResource } from '../styles/theme/types';

export interface FakeProcessor<T> {
  /** Backing cache: `undefined` = never requested, `null` = failed or sentinel miss, value = loaded. */
  readonly cache: Map<string, T | null>;
  /** Pin counts, to assert that useResource wires pin and unpin. */
  readonly pinCounts: Map<string, number>;
  // Public ResourceProcessor<T> surface consumed by useResource:
  request(path: string): void;
  getCached(path: string): T | null | undefined;
  isCached(path: string): boolean;
  isLoading(path: string): boolean;
  clearCache(path?: string): void;
  cachedPaths(): string[];
  inflightPaths(): string[];
  getCacheSize(): number;
  pin(path: string): void;
  unpin(path: string): void;
  /** Overrides what `request()` does: a spy to assert calls, or a no-op. */
  setRequestImpl(impl: (path: string) => void): void;
  /** Seed the cache without emitting. `null` seeds a sentinel miss. */
  seed(path: string, value: T | null): void;
  /**
   * Simulates a successful load: caches the value and emits `<type>:loaded`.
   * Always a new-era completion: the real pipeline drops a flight that departed
   * before a clear, so do not model that case with `_resolve` or `_fail`.
   */
  _resolve(path: string, value: T): void;
  /** Simulates a failure: caches `null` and emits `<type>:failed`. See `_resolve`'s era note. */
  _fail(path: string, message: string): void;
}

export interface FakeResourceLoader {
  /** The fake typed as the real `ResourceLoader`, for `ResourceLoaderProvider`. */
  readonly loader: ResourceLoader;
  readonly eventBus: ResourceEventBus;
  readonly metadata: MetadataStore;
  readonly textures: FakeProcessor<THREE.Texture>;
  readonly materials: FakeProcessor<THREE.Material>;
  readonly glbMeshes: FakeProcessor<THREE.Object3D>;
  readonly scenes: FakeProcessor<TscnScene>;
  readonly resources: FakeProcessor<ParsedResource>;
  readonly arrayMeshes: FakeProcessor<ArrayMeshResource>;
  readonly fonts: FakeProcessor<FontResource>;
  readonly themes: FakeProcessor<ThemeResource>;
  /** Every ExtResource passed to `loader.register`, in call order. */
  readonly registerCalls: ExtResource[];
}

function makeFakeProcessor<T>(eventBus: ResourceEventBus, type: ResourceType): FakeProcessor<T> {
  const cache = new Map<string, T | null>();
  const pinCounts = new Map<string, number>();
  let requestImpl: (path: string) => void = () => {};
  return {
    cache,
    pinCounts,
    request(path: string): void {
      requestImpl(path);
    },
    getCached(path: string): T | null | undefined {
      return cache.get(path);
    },
    isCached(path: string): boolean {
      return cache.has(path);
    },
    isLoading(_path: string): boolean {
      return false;
    },
    clearCache(path?: string): void {
      if (path === undefined) cache.clear();
      else cache.delete(path);
    },
    cachedPaths(): string[] {
      return [...cache.keys()];
    },
    // Loads are driven by `_resolve` and `_fail`, so nothing is ever in flight.
    inflightPaths(): string[] {
      return [];
    },
    getCacheSize(): number {
      return cache.size;
    },
    pin(path: string): void {
      pinCounts.set(path, (pinCounts.get(path) ?? 0) + 1);
    },
    unpin(path: string): void {
      const count = pinCounts.get(path) ?? 0;
      if (count <= 1) pinCounts.delete(path);
      else pinCounts.set(path, count - 1);
    },
    setRequestImpl(impl: (path: string) => void): void {
      requestImpl = impl;
    },
    seed(path: string, value: T | null): void {
      cache.set(path, value);
    },
    _resolve(path: string, value: T): void {
      cache.set(path, value);
      eventBus.emit<T>(type, 'loaded', path, value);
    },
    _fail(path: string, message: string): void {
      cache.set(path, null);
      eventBus.emit<Error>(type, 'failed', path, new Error(message));
    },
  };
}

export function createFakeResourceLoader(): FakeResourceLoader {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const textures = makeFakeProcessor<THREE.Texture>(eventBus, 'texture');
  const materials = makeFakeProcessor<THREE.Material>(eventBus, 'material');
  const glbMeshes = makeFakeProcessor<THREE.Object3D>(eventBus, 'glb');
  const scenes = makeFakeProcessor<TscnScene>(eventBus, 'scene');
  const resources = makeFakeProcessor<ParsedResource>(eventBus, 'resource');
  const arrayMeshes = makeFakeProcessor<ArrayMeshResource>(eventBus, 'arraymesh');
  const fonts = makeFakeProcessor<FontResource>(eventBus, 'font');
  const themes = makeFakeProcessor<ThemeResource>(eventBus, 'theme');
  const registerCalls: ExtResource[] = [];

  const byType: Record<ResourceType, FakeProcessor<unknown>> = {
    texture: textures,
    material: materials,
    glb: glbMeshes,
    scene: scenes,
    resource: resources,
    arraymesh: arrayMeshes,
    font: fonts,
    theme: themes,
  };
  const all = Object.values(byType);

  const loader = {
    // The one accessor `useResource` reads a processor through, keyed by bus.
    processor: (type: ResourceType) => byType[type],
    eventBus,
    metadata,
    textures,
    materials,
    glbMeshes,
    scenes,
    resources,
    arrayMeshes,
    fonts,
    themes,
    // Mirrors ResourceLoader.register and records the call, so a test asserts
    // registration without a vitest spy.
    register(resource: ExtResource): void {
      registerCalls.push(resource);
      metadata.register(resource);
    },
    // Mirrors ResourceLoader.provideFile: clear the path everywhere, then re-route
    // to the metadata-typed processor, else the .tres and texture+material fan-outs.
    // Re-requests land in `requestImpl`, so `setRequestImpl` spies observe them.
    provideFile(path: string): void {
      for (const proc of all) proc.clearCache(path);
      const busType = busTypeFor(metadata.get(path)?.type);
      if (busType) {
        byType[busType].request(path);
      } else if (path.endsWith('.tres')) {
        materials.request(path);
        resources.request(path);
        fonts.request(path);
        themes.request(path);
      } else {
        textures.request(path);
        materials.request(path);
      }
    },
    clear(): void {
      for (const proc of all) proc.clearCache();
      eventBus.clear();
      metadata.clear();
    },
    // The real clearCaches sequence through its single owner: order is the
    // contract, so the fake runs the same sequence, not a copy.
    clearCaches(): void {
      runClearCachesSequence({
        processors: Object.entries(byType) as [ResourceType, FakeProcessor<unknown>][],
        eventBus,
        metadata,
      });
    },
    // The pending-resource count the real loader tracks for `CameraFit`. Mirrored,
    // not stubbed: every mounted `useResource` registers here, so a dropped count
    // would hide a leak.
    pendingCount: 0,
    pendingListeners: new Set<() => void>(),
    beginPending(): () => void {
      this.pendingCount += 1;
      for (const l of this.pendingListeners) l();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.pendingCount -= 1;
        for (const l of this.pendingListeners) l();
      };
    },
    get pendingResourceCount(): number {
      return this.pendingCount;
    },
    subscribePending(listener: () => void): () => void {
      this.pendingListeners.add(listener);
      return () => this.pendingListeners.delete(listener);
    },
  };

  return {
    loader: loader as unknown as ResourceLoader,
    eventBus,
    metadata,
    textures,
    materials,
    glbMeshes,
    scenes,
    resources,
    arrayMeshes,
    fonts,
    themes,
    registerCalls,
  };
}
