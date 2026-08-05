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
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { buildFontResource, type FontResource } from '../processing/fontProcessing';

export function createFontProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<FontResource> {
  // Assigned once `createResourceProcessor` returns, below; `process()` only
  // ever runs after a `.request()` call, always after this function has
  // returned, so the closure over the not-yet-assigned binding is safe.
  let processor: ResourceProcessor<FontResource>;

  const loadFont = async (address: string): Promise<FontResource | null> => {
    const cached = processor.getCached(address);
    if (cached !== undefined) return cached;
    processor.request(address);
    try {
      return await eventBus.once<FontResource>('font', 'loaded', address);
    } catch {
      return null;
    }
  };

  processor = createResourceProcessor<FontResource>({
    fileEventBus,
    eventBus,
    resourceType: 'font',
    shouldProcess: (_path, data) => data instanceof ArrayBuffer || typeof data === 'string',
    addressesSubResources: true,
    process: (path, data) => buildFontResource(path, data, loadFont),
  });

  return processor;
}
