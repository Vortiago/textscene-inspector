/**
 * Factory for the font resource processor — fifth peer of texture / material /
 * GLB / scene, over the SAME `createResourceProcessor` cache/inflight/event
 * loop. Mirrors the material processor's shape most closely: both fetch
 * through `FileEventBus`, both address a **Sub-resource path**
 * (`res://file.tres::SubId`), and both need to load OTHER resources — a
 * material loads its textures, a font loads its `base_font`/`fallbacks`.
 *
 * The recursion is self-contained: `loadFont` requests through THIS
 * processor (closing over it once construction finishes) rather than taking
 * an injected loader, since a Font's dependencies are always other Fonts.
 *
 * `shouldProcess` deliberately accepts every loaded file rather than
 * pre-filtering by extension. `FileEventBus` only ever hands it the bare
 * FILE path — never whether one of the addresses awaiting that file carries
 * a `::SubId` — so an extension gate here (e.g. rejecting anything that
 * isn't `.tres`) would make a sub-resource address into a `.tscn` (a scene's
 * own inline `FontFile`/`FontVariation`, a real shape this corpus has)
 * decline `shouldProcess` and sit in `inflight` forever: no `loaded`, no
 * `failed`, a `useResource` consumer stuck in `pending` permanently.
 * Accepting everything here and letting `buildFontResource` throw for
 * content that turns out not to be a font — a mistyped raw file, or
 * `parseTresFile`'s own `[gd_resource]`-header check — turns every such
 * address into a clean, prompt `failed` event instead.
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
  // Assigned once `createResourceProcessor` returns, below; `process()` only
  // ever runs after a `.request()` call, always after this function has
  // returned, so the closure over the not-yet-assigned binding is safe.
  let processor: ResourceProcessor<FontResource>;

  // Who is waiting on whom: address → the addresses its own `process` is
  // currently parked on. `base_font`/`fallbacks` are ordinary paths, so two
  // files can name each other, and the leg that closes such a ring would park
  // on a `once` only its own waiter can settle — wedging every address on it.
  //
  // A DEPENDENCY EDGE, not a "currently loading" flag: a flag cannot tell a
  // real ring from two independent loads that merely overlap in time, and
  // would resolve a perfectly ordinary shared base font to null whenever its
  // dependent happened to be in flight beside it.
  const waitingFor = new Map<string, Set<string>>();

  /** Would `parent` waiting on `address` close a ring — is `parent` already downstream of it? */
  const wouldCycle = (parent: string, address: string): boolean => {
    if (parent === address) return true;
    const seen = new Set<string>();
    const stack = [address];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (next === parent) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      for (const edge of waitingFor.get(next) ?? []) stack.push(edge);
    }
    return false;
  };

  /** `ResourceLoader.peerLoad` plus the cycle check, which is why it is not that method. */
  const loadFont = async (parent: string, address: string): Promise<FontResource | null> => {
    const cached = processor.getCached(address);
    if (cached !== undefined) return cached;
    if (wouldCycle(parent, address)) return null;
    let edges = waitingFor.get(parent);
    if (!edges) {
      edges = new Set<string>();
      waitingFor.set(parent, edges);
    }
    edges.add(address);
    processor.request(address);
    try {
      return await eventBus.once<FontResource>('font', 'loaded', address, PEER_LOAD_TIMEOUT_MS);
    } catch {
      return null;
    } finally {
      // A settled wait is nobody's deadlock: leaving the edge would let a LATER
      // wait walk a dependency nothing is parked on. The entry goes once its
      // last edge does, which a concurrent re-process of the same address keeps
      // alive by still holding one.
      edges.delete(address);
      if (edges.size === 0) waitingFor.delete(parent);
    }
  };

  processor = createResourceProcessor<FontResource>({
    fileEventBus,
    eventBus,
    resourceType: 'font',
    shouldProcess: (_path, data) => data instanceof ArrayBuffer || typeof data === 'string',
    addressesSubResources: true,
    // The peer loader is bound to the address being built, so every wait it
    // parks on is recorded against its own requester rather than against the
    // processor as a whole.
    process: (path, data) => buildFontResource(path, data, (address) => loadFont(path, address)),
  });

  return processor;
}
