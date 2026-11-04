/**
 * The font resource processor, on the shared `createResourceProcessor` loop. It routes
 * by path: a raw font container loads as bytes, and anything else reads the owning
 * file's cached parse. A BMFont descriptor loads with its page images. It addresses a **Sub-resource path** (`res://file.tres::SubId`)
 * and loads other fonts: a font's `base_font`/`fallbacks`.
 */

import type { FileData, FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import {
  createResourceProcessor,
  PEER_LOAD_TIMEOUT_MS,
  type ResourceProcessor,
} from '../createResourceProcessor';
import type { DependencyGraph } from '../dependencyGraph';
import { buildFontResource, fontResourceFromBitmap, fontResourceFromContainer } from '../fonts/font/loadFont';
import { isFontContainerPath } from '../formats/dynamicfont/fontBytes';
import { isBmfontPath } from '../formats/bmfont/extensions';
import { loadBitmapFont } from '../formats/bmfont/loadBitmapFont';
import type { PageImage } from '../formats/bmfont/pageFill';
import { decodeImagePixels, getMimeType } from '../formats/image/textureProcessing';
import { imageSourceFormat } from '../../godot/import/imageSourceFormat';
import type { FontResource } from '../fonts/font/types';
import type { SectionLoaderFn } from '../resourceSection';
import { FONT_SUB_RESOURCE_TYPES } from '../fonts/font/decode';
import { readImportSidecar } from './readImportSidecar';

export function createFontProcessor(
  eventBus: ResourceEventBus,
  loadSection: SectionLoaderFn,
  /** A raw font container's bytes. Rejects when the file is missing. */
  readFile: (path: string) => Promise<FileData>,
  /** Records each font a font reads, and a raw font's read of its sidecar, so a change to that file reloads the reader. */
  dependencies: DependencyGraph,
  fileEventBus: FileEventBus | undefined
): ResourceProcessor<FontResource> {
  // Assigned once `createResourceProcessor` returns, below. `loadDirectly` only
  // ever runs after a `.request()` call, always after this function has
  // returned, so the closure over the not-yet-assigned binding is safe.
  let processor: ResourceProcessor<FontResource>;

  // Address → the addresses its load is parked on. Two files can name each
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

  /** The `[params]` of a raw font's `.import` sidecar, which Godot's importer sets on the FontFile. */
  const importParamsOf = async (path: string): Promise<Record<string, string>> => {
    const sidecar = await readImportSidecar({
      assetPath: path,
      dependent: { busType: 'font', key: path },
      fileEventBus,
      dependencies,
    });
    return sidecar?.params ?? {};
  };

  /** A BMFont page: its bytes, decoded to pixels, with the format Godot's image loader gives the file. Records the page as a read of `font`, so a change to it reloads the font. */
  const readPageImage =
    (font: string) =>
    async (page: string): Promise<PageImage> => {
      dependencies.record({ busType: 'font', key: font }, page);
      const data = await readFile(page);
      if (typeof data === 'string') throw new Error(`${page} is text, not an image`);
      const mimeType = getMimeType(page);
      return {
        pixels: await decodeImagePixels(data, mimeType, eventBus.getThreeManager()),
        source: imageSourceFormat(new Uint8Array(data), mimeType),
      };
    };

  /** A `.fnt` or `.font` file as a BMFont `FontFile`. The descriptor is text or binary, so a provider's string is encoded back to bytes. */
  const loadBitmap = async (path: string): Promise<FontResource> => {
    const [data, importParams] = await Promise.all([readFile(path), importParamsOf(path)]);
    const bytes = typeof data === 'string' ? (new TextEncoder().encode(data).buffer as ArrayBuffer) : data;
    return fontResourceFromBitmap(
      await loadBitmapFont(path, bytes, readPageImage(path), importParams),
      importParams
    );
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
    loadDirectly: async (path) => {
      if (isBmfontPath(path)) return loadBitmap(path);
      return isFontContainerPath(path)
        ? fontResourceFromContainer(path, ...(await Promise.all([readFile(path), importParamsOf(path)])))
        : buildFontResource(path, await loadSection(path, FONT_SUB_RESOURCE_TYPES), (address) =>
            loadFont(path, address)
          );
    },
  });

  return processor;
}
