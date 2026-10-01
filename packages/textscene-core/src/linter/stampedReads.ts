/**
 * What the linter read from a host's files, kept per provider under each file's stamp, so a host that lints on each
 * edit reads an unchanged file once. Only the answer is kept, never the bytes. A host drops its provider when its
 * project view changes, and the answers go with it.
 */

import type { ResourceProvider } from '../resources/ResourceProvider.js';

/**
 * The stamp of `path`, or null where the provider gives none or its stamp read rejects: both mean the file is read.
 * A synchronous throw is a provider bug, and it propagates.
 */
export function stampOf(provider: ResourceProvider, path: string): Promise<string | null> {
  return provider.stamp ? provider.stamp(path).catch(() => null) : Promise.resolve(null);
}

/**
 * The content of `path`, or null for a file the provider does not hold. A rejection counts as a miss, since the web
 * provider throws for a missing file where the contract says null. A synchronous throw propagates.
 */
export function loadOrNull(
  provider: ResourceProvider,
  path: string,
  type?: string
): Promise<string | ArrayBuffer | null> {
  return provider.loadResource(path, type).catch(() => null);
}

interface Kept<T> {
  readonly stamp: string;
  readonly value: T;
}

/** A read in flight, and the stamp it was taken under: null for a file with no stamp. */
interface Running<T> {
  readonly stamp: string | null;
  readonly answer: Promise<T>;
}

/** One provider's reads: the kept answers, and the reads still running, each by `res://` path. */
interface ProviderReads<T> {
  readonly kept: Map<string, Kept<T>>;
  readonly running: Map<string, Running<T>>;
}

export class StampedReads<T> {
  /**
   * Each provider's reads. `get` writes a kept answer after each stamped read and a running read while it runs, and
   * deletes the running one once it settles. Both go with the provider.
   */
  private readonly byProvider = new WeakMap<ResourceProvider, ProviderReads<T>>();

  /**
   * The answer `read` gives for `path`, kept under the stamp taken before the read while that stamp is unchanged. A null
   * answer, a file the read could not deliver, is never kept. A get shares a read of `path` still running under the
   * same stamp, so concurrent lints read an unchanged file once. With no stamp at all, the read starts at once.
   *
   * @param stamp - The file's stamp, when the caller started reading it earlier.
   */
  get(
    provider: ResourceProvider,
    path: string,
    read: () => Promise<T>,
    stamp?: Promise<string | null>
  ): Promise<T> {
    if (!stamp && !provider.stamp) return this.shared(provider, path, null, read);
    return this.stampedRead(provider, path, read, stamp ?? stampOf(provider, path));
  }

  /** The answer kept for `path`, whatever the file's stamp is now, or undefined for none. A running read is none. */
  peek(provider: ResourceProvider, path: string): T | undefined {
    return this.byProvider.get(provider)?.kept.get(path)?.value;
  }

  private async stampedRead(
    provider: ResourceProvider,
    path: string,
    read: () => Promise<T>,
    stamp: Promise<string | null>
  ): Promise<T> {
    const current = await stamp;
    const before = this.readsOf(provider).kept.get(path);
    if (current !== null && before?.stamp === current) return before.value;
    return this.shared(provider, path, current, () => this.keptRead(provider, path, read, current));
  }

  /** The answer `read` gives, kept under `stamp` unless the stamp or the answer is null. */
  private async keptRead(
    provider: ResourceProvider,
    path: string,
    read: () => Promise<T>,
    stamp: string | null
  ): Promise<T> {
    const value = await read();
    const { kept } = this.readsOf(provider);
    if (stamp === null || value === null) kept.delete(path);
    else kept.set(path, { stamp, value });
    return value;
  }

  /**
   * The read of `path` running under `stamp`, or a new one that `read` starts. A read under another stamp is not shared:
   * it may answer for content the file no longer has.
   */
  private shared(
    provider: ResourceProvider,
    path: string,
    stamp: string | null,
    read: () => Promise<T>
  ): Promise<T> {
    const { running } = this.readsOf(provider);
    const inFlight = running.get(path);
    if (inFlight !== undefined && inFlight.stamp === stamp) return inFlight.answer;

    // Through an async function, so a read that throws at once rejects like one that fails later.
    const entry: Running<T> = { stamp, answer: (async () => read())() };
    running.set(path, entry);
    const settle = () => {
      if (running.get(path) === entry) running.delete(path);
    };
    entry.answer.then(settle, settle);
    return entry.answer;
  }

  private readsOf(provider: ResourceProvider): ProviderReads<T> {
    let reads = this.byProvider.get(provider);
    if (!reads) {
      reads = { kept: new Map(), running: new Map() };
      this.byProvider.set(provider, reads);
    }
    return reads;
  }
}
