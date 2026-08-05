/**
 * Test-only fixture: a fake `ResourceLoader` whose cache state and event
 * emissions a test can drive deterministically, without spinning up a
 * FileEventBus + provider.
 *
 * Concentrates the assembly that every resource-consuming test used to
 * hand-roll: a real `ResourceEventBus` + `MetadataStore` plus Map-backed
 * processors for every slot the real loader carries (texture / material /
 * glb / scene / resource / arraymesh / font) implementing the public
 * `ResourceProcessor` surface, wired with `register()`, `clear()` and
 * `provideFile()`. Each processor handle adds a small driving API:
 *
 *   - `_resolve(path, value)` — cache + emit `<type>:loaded` (event-driven tests)
 *   - `_fail(path, message)`  — cache null + emit `<type>:failed`
 *   - `seed(path, value)`     — cache only, no emit (cache-seeding tests; null = sentinel miss)
 *   - `setRequestImpl(fn)`    — override what `request()` does (e.g. a spy or no-op)
 *   - `cache`                 — the backing Map, for direct seeding/deletion
 *
 * Pure: imports only THREE + the real bus/metadata, never `vitest`, so a
 * test asserts request behaviour with its own spy via `setRequestImpl`.
 * Lives under `testing/` (excluded from the package build) so it never
 * reaches dist or the linter graph.
 */

import * as THREE from 'three';
import type { ParsedTresFile } from '../../parser/tresParser';
import type { ExtResource, TscnScene } from '../../parser/types';
import { ResourceEventBus, type ResourceType } from '../ResourceEventBus';
import { MetadataStore } from '../MetadataStore';
import { busTypeFor, type ResourceLoader } from '../ResourceLoader';
import { runClearCachesSequence } from '../clearCachesSequence';
import type { ArrayMeshResource } from '../processors/createArrayMeshProcessor';
import type { FontResource } from '../processing/fontProcessing';

export interface FakeProcessor<T> {
  /** Backing cache — `undefined` = never requested, `null` = failed/sentinel-miss, value = loaded. */
  readonly cache: Map<string, T | null>;
  /** Pin counts — for asserting that useResource wires pin/unpin correctly. */
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
  /** Override what `request()` does — pass a spy to assert calls, or a no-op. */
  setRequestImpl(impl: (path: string) => void): void;
  /** Seed the cache without emitting. `null` seeds a sentinel miss. */
  seed(path: string, value: T | null): void;
  /**
   * Simulate a successful load: cache the value + emit `<type>:loaded`.
   * Always a NEW-era completion — the real pipeline DROPS completions whose
   * flight departed before a clear (flight tokens), which a manually-driven
   * fake cannot represent; don't use `_resolve`/`_fail` to model a load that
   * was in flight when a clear happened.
   */
  _resolve(path: string, value: T): void;
  /** Simulate a failure: cache `null` + emit `<type>:failed`. See `_resolve`'s era note. */
  _fail(path: string, message: string): void;
}

export interface FakeResourceLoader {
  /** The fake typed as the real `ResourceLoader` — pass to `ResourceLoaderProvider`. */
  readonly loader: ResourceLoader;
  readonly eventBus: ResourceEventBus;
  readonly metadata: MetadataStore;
  readonly textures: FakeProcessor<THREE.Texture>;
  readonly materials: FakeProcessor<THREE.Material>;
  readonly glbMeshes: FakeProcessor<THREE.Object3D>;
  readonly scenes: FakeProcessor<TscnScene>;
  readonly resources: FakeProcessor<ParsedTresFile>;
  readonly arrayMeshes: FakeProcessor<ArrayMeshResource>;
  readonly fonts: FakeProcessor<FontResource>;
  /** Every ExtResource passed to `loader.register`, in call order — for assertions. */
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
    // The fake has no async flights — loads are driven manually via
    // `_resolve`/`_fail` — so nothing is ever "in flight".
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
  const resources = makeFakeProcessor<ParsedTresFile>(eventBus, 'resource');
  const arrayMeshes = makeFakeProcessor<ArrayMeshResource>(eventBus, 'arraymesh');
  const fonts = makeFakeProcessor<FontResource>(eventBus, 'font');
  const registerCalls: ExtResource[] = [];

  const byType: Record<ResourceType, FakeProcessor<unknown>> = {
    texture: textures,
    material: materials,
    glb: glbMeshes,
    scene: scenes,
    resource: resources,
    arraymesh: arrayMeshes,
    font: fonts,
  };
  const all = Object.values(byType);

  const loader = {
    eventBus,
    metadata,
    textures,
    materials,
    glbMeshes,
    scenes,
    resources,
    arrayMeshes,
    fonts,
    // Mirror ResourceLoader.register (metadata bookkeeping) and record the
    // call so tests can assert registration without a vitest spy.
    register(resource: ExtResource): void {
      registerCalls.push(resource);
      metadata.register(resource);
    },
    // Mirror the real ResourceLoader.provideFile: clear the path everywhere,
    // then re-route — metadata-typed processor when known, the same .tres and
    // texture+material fan-outs otherwise. Re-requests land in each
    // processor's `requestImpl`, so `setRequestImpl` spies observe them.
    provideFile(path: string): void {
      for (const proc of all) proc.clearCache(path);
      const busType = busTypeFor(metadata.get(path)?.type);
      if (busType) {
        byType[busType].request(path);
      } else if (path.endsWith('.tres')) {
        materials.request(path);
        resources.request(path);
        fonts.request(path);
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
    // The real clearCaches choreography, via its single owner — order is
    // the contract, so the fake runs the SAME sequence rather than a copy.
    clearCaches(): void {
      runClearCachesSequence({
        processors: Object.entries(byType) as [ResourceType, FakeProcessor<unknown>][],
        eventBus,
        metadata,
      });
    },
    // The pending-resource activity the real loader tracks for `CameraFit`.
    // Mirrored rather than stubbed to no-ops: every mounted `useResource`
    // registers here, so a fake that silently dropped the count would let a
    // leak through unnoticed.
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
    registerCalls,
  };
}
