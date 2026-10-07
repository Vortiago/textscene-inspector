/**
 * The font resource processor, on the shared `createResourceProcessor` loop. It routes
 * by path: a raw font container loads as bytes, and anything else reads the owning
 * file's cached parse. It addresses a **Sub-resource path** (`res://file.tres::SubId`)
 * and loads other fonts: a font's `base_font`/`fallbacks`.
 */

import type { FileData } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import {
  createResourceProcessor,
  PEER_LOAD_TIMEOUT_MS,
  type ResourceProcessor,
} from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { buildFontResource, fontResourceFromContainer } from '../fonts/font/loadFont';
import { isFontContainerPath } from '../formats/dynamicfont/fontBytes';
import type { FontResource } from '../fonts/font/types';
import type { SectionLoaderFn } from '../resourceSection';
import { FONT_SUB_RESOURCE_TYPES } from '../fonts/font/decode';

export function createFontProcessor(
  eventBus: ResourceEventBus,
  loadSection: SectionLoaderFn,
  /** A raw font container's bytes. Rejects when the file is missing. */
  readFile: (path: string) => Promise<FileData>,
  /** Records each font a font reads, so a change to that file reloads the reader. */
  dependencies: DependencyGraph
): ResourceProcessor<FontResource> {
  // Assigned once `createResourceProcessor` returns, below. `process()` only
  // ever runs after a `.request()` call, always after this function has
  // returned, so the closure over the not-yet-assigned binding is safe.
  let processor: ResourceProcessor<FontResource>;

  // Address → the addresses its `process` is parked on. Two files can name each
  // other, and the leg closing that ring would park on a `once` only its own
  // waiter settles. An edge, not a "loading" flag, which cannot tell a ring from
  // two overlapping loads and would null an ordinary shared base font.
  const waitingFor = new Map<string, Map<string, number>>();

  /** Would `parent` waiting on `address` close a ring: is `parent` already downstream of it? */
  const wouldCycle = (parent: string, address: string): boolean => {
    if (parent === address) return true;
    const seen = new Set<string>();
    const stack = [address];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (next === parent) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      for (const edge of waitingFor.get(next)?.keys() ?? []) stack.push(edge);
    }
    return false;
  };

  /**
   * `ResourceLoader.peerLoad` plus the cycle check, which is why it is not that
   * method. It requests through this processor, since a Font depends only on Fonts.
   */
  const loadFont = async (parent: string, address: string): Promise<FontResource | null> => {
    // Before the cache answer, so a read served from cache, a failed one and one
    // still in flight all reload `parent` when `address` changes.
    dependencies.record({ busType: 'font', key: parent }, address);
    const cached = processor.getCached(address);
    if (cached !== undefined) return cached;
    if (wouldCycle(parent, address)) return null;
    let edges = waitingFor.get(parent);
    if (!edges) {
      edges = new Map<string, number>();
      waitingFor.set(parent, edges);
    }
    // Counted, not a set: `fallbacks` can name one font twice, and its waits run
    // at once, so the first to settle must not sever the other's edge.
    edges.set(address, (edges.get(address) ?? 0) + 1);
    processor.request(address);
    try {
      return await eventBus.once<FontResource>('font', 'loaded', address, PEER_LOAD_TIMEOUT_MS);
    } catch {
      return null;
    } finally {
      // A settled wait is nobody's deadlock: leaving the edge would let a later
      // wait walk a dependency nothing is parked on. Only this wait's count
      // goes, and the entry goes with the last of them, when nothing else can
      // still hold this map.
      const remaining = (edges.get(address) ?? 1) - 1;
      if (remaining > 0) edges.set(address, remaining);
      else edges.delete(address);
      if (edges.size === 0) waitingFor.delete(parent);
    }
  };

  processor = createResourceProcessor<FontResource>({
    eventBus,
    resourceType: 'font',
    addressesSubResources: true,
    // The extension is the binary signal (ADR-0031). A `::SubId` breaks it, so such an
    // address goes to the parse, which fails a `.ttf` or a `.tscn` at once. The peer
    // loader is bound to the address being built, so every wait it parks on is
    // recorded against its own requester.
    loadDirectly: async (path) =>
      isFontContainerPath(path)
        ? fontResourceFromContainer(path, await readFile(path))
        : buildFontResource(path, await loadSection(path, FONT_SUB_RESOURCE_TYPES), (address) =>
            loadFont(path, address)
          ),
  });

  return processor;
}
