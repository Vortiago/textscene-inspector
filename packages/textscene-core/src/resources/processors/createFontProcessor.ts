/**
 * The font resource processor, on the shared `createResourceProcessor` loop.
 * Like the material processor it fetches through `FileEventBus`, addresses a
 * **Sub-resource path** (`res://file.tres::SubId`) and loads other resources:
 * a font's `base_font`/`fallbacks`.
 */

import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import {
  createResourceProcessor,
  PEER_LOAD_TIMEOUT_MS,
  type ResourceProcessor,
} from '../createResourceProcessor';
import { buildFontResource } from '../fonts/font/loadFont';
import type { FontResource } from '../fonts/font/types';

export function createFontProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
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
    const cached = processor.getCached(address);
    if (cached !== undefined) return cached;
    if (wouldCycle(parent, address)) return null;
    let edges = waitingFor.get(parent);
    if (!edges) {
      edges = new Map<string, number>();
      waitingFor.set(parent, edges);
    }
    // Counted, not a set: the byte bus re-broadcasts a cached file to every
    // address in flight for it, so two waits can park on one address, and the
    // first to settle must not sever the other's edge.
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
    fileEventBus,
    eventBus,
    resourceType: 'font',
    // Every loaded file: the bus hands over only the bare file path, so an
    // extension gate would leave a `::SubId` address into a `.tscn` in `inflight`
    // forever. `buildFontResource` throws on content that is not a font, which
    // turns such an address into a prompt `failed` event.
    shouldProcess: (_path, data) => data instanceof ArrayBuffer || typeof data === 'string',
    addressesSubResources: true,
    // The peer loader is bound to the address being built, so every wait it
    // parks on is recorded against its own requester rather than against the
    // processor as a whole.
    process: (path, data) => buildFontResource(path, data, (address) => loadFont(path, address)),
  });

  return processor;
}
