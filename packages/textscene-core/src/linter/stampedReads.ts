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
 * The content of `path`, or null for a file the provider does not hold. A rejection counts as a miss, since the VS Code
 * and web providers throw for a missing file where the contract says null. A synchronous throw propagates.
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

/** One provider's reads: the kept answers, and the reads still running, each by `res://` path. */
interface ProviderReads<T> {
  readonly kept: Map<string, Kept<T>>;
  readonly running: Map<string, Promise<T>>;
}

export class StampedReads<T> {
  /**
   * Each provider's reads. `get` writes a kept answer after each stamped read and a running read while it runs, and
   * deletes the running one once it settles. Both go with the provider.
   */
  private readonly byProvider = new WeakMap<ResourceProvider, ProviderReads<T>>();

  /**
   * The answer `read` gives for `path`, kept under the file's stamp while the stamp is unchanged. The stamp is taken
   * before the read, so a file that changes between the two is kept under the older stamp and read again next time.
   * A file with no stamp is read, and its older answer is forgotten. With no stamp at all, the read starts at once.
   * A get that arrives while a get of the same path runs shares that one's answer, so concurrent lints stat and read
   * a file once.
   *
   * @param stamp - The file's stamp, when the caller started reading it earlier. A shared get ignores it.
   */
  get(
    provider: ResourceProvider,
    path: string,
    read: () => Promise<T>,
    stamp?: Promise<string | null>
  ): Promise<T> {
    const { running } = this.readsOf(provider);
    const shared = running.get(path);
    if (shared) return shared;

    const answer = this.stampedRead(provider, path, read, stamp);
    running.set(path, answer);
    const settle = () => {
      if (running.get(path) === answer) running.delete(path);
    };
    answer.then(settle, settle);
    return answer;
  }

  /** The answer kept for `path`, whatever the file's stamp is now, or undefined for none. A running read is none. */
  peek(provider: ResourceProvider, path: string): T | undefined {
    return this.byProvider.get(provider)?.kept.get(path)?.value;
  }

  private async stampedRead(
    provider: ResourceProvider,
    path: string,
    read: () => Promise<T>,
    stamp: Promise<string | null> | undefined
  ): Promise<T> {
    if (!stamp && !provider.stamp) return read();
    const current = await (stamp ?? stampOf(provider, path));
    const { kept } = this.readsOf(provider);
    const before = kept.get(path);
    if (current !== null && before?.stamp === current) return before.value;

    const value = await read();
    if (current === null) kept.delete(path);
    else kept.set(path, { stamp: current, value });
    return value;
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
