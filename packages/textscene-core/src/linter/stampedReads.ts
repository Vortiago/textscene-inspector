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
export function loadOrNull(provider: ResourceProvider, path: string, type?: string): Promise<string | ArrayBuffer | null> {
  return provider.loadResource(path, type).catch(() => null);
}

interface Kept<T> {
  readonly stamp: string;
  readonly value: T;
}

export class StampedReads<T> {
  /** Each provider's answers by `res://` path. Written by `get` after each read, and gone with the provider. */
  private readonly byProvider = new WeakMap<ResourceProvider, Map<string, Kept<T>>>();

  /**
   * The answer `read` gives for `path`, kept under the file's stamp while the stamp is unchanged. The stamp is taken
   * before the read, so a file that changes between the two is kept under the older stamp and read again next time.
   * A file with no stamp is read, and its older answer is forgotten. With no stamp at all, the read starts at once.
   *
   * @param stamp - The file's stamp, when the caller started reading it earlier
   */
  async get(
    provider: ResourceProvider,
    path: string,
    read: () => Promise<T>,
    stamp?: Promise<string | null>
  ): Promise<T> {
    if (!stamp && !provider.stamp) return read();
    const current = await (stamp ?? stampOf(provider, path));
    const answers = this.byProvider.get(provider);
    const kept = answers?.get(path);
    if (current !== null && kept?.stamp === current) return kept.value;

    const value = await read();
    if (current === null) answers?.delete(path);
    else this.answersOf(provider).set(path, { stamp: current, value });
    return value;
  }

  /** The answer kept for `path`, whatever the file's stamp is now, or undefined for none. */
  peek(provider: ResourceProvider, path: string): T | undefined {
    return this.byProvider.get(provider)?.get(path)?.value;
  }

  private answersOf(provider: ResourceProvider): Map<string, Kept<T>> {
    let answers = this.byProvider.get(provider);
    if (!answers) {
      answers = new Map();
      this.byProvider.set(provider, answers);
    }
    return answers;
  }
}
