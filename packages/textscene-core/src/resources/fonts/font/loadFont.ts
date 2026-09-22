/**
 * The Font slice's whole-file loader — the seam between a fetched file and
 * `decode.ts`'s section decode, and the one entry point
 * `processors/createFontProcessor.ts` calls.
 *
 * This is the module that consumes whole-file CONTENT (`parseTresFile`),
 * mirroring the StandardMaterial3D slice's `loadMaterial.ts`: the decode
 * itself stays pure over a property bag, while sub-resource addressing and
 * the two arrival SHAPES a font-typed address can take are resolved here.
 */

import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import { fontResourceFromBytes, isFontContainerPath } from '../../formats/dynamicfont/fontBytes';
import { findSubResource } from '../../SubResourceResolver';
import { parseSubResourcePath } from '../../subResourcePath';
import { decodeFont, FONT_SUB_RESOURCE_TYPES } from './decode';
import type { FontLoaderFn, FontResource } from './types';

/**
 * Build a `FontResource` from a `.tres`'s text content — either its own
 * `[resource]` body (`subResourceId` absent) or a named `[sub_resource]`
 * inside it (a `.tres` that carries more than one Font — e.g. a shared
 * fonts-library file). `content` must carry a `[gd_resource]` header
 * (`parseTresFile`'s requirement); a scene's OWN inline
 * FontFile/SystemFont/FontVariation sub-resource is never addressed this way —
 * it resolves synchronously against the scene's own parsed SubResources
 * (`decode.ts`'s `resolveInlineFontResource`), the same path every other
 * node-local SubResource takes, never through the resource event bus.
 */
export async function createFontResourceFromContent(
  filePath: string,
  content: string,
  loadFont: FontLoaderFn,
  subResourceId?: string
): Promise<FontResource> {
  const parsed: ParsedResource = parseTresFile(content);

  let resourceType: string;
  let properties: Record<string, string>;

  if (subResourceId !== undefined) {
    const sub = findSubResource(parsed.subResources, subResourceId);
    if (!sub) {
      throw new Error(`Sub-resource "${subResourceId}" is not declared in ${filePath}`);
    }
    resourceType = sub.type;
    // `parseInternalResource` echoes the heading's own `id` into `data` (so
    // `findSubResource` can match it structurally too) — strip it back out,
    // or it leaks into `properties` as a fake declared property no Godot
    // file ever wrote.
    const { id: _id, ...rest } = sub.data as Record<string, string>;
    properties = rest;
  } else {
    resourceType = parsed.resourceType;
    properties = parsed.properties;
  }

  if (!FONT_SUB_RESOURCE_TYPES.has(resourceType)) {
    throw new Error(`Not a font resource type: ${resourceType} (${filePath})`);
  }

  return decodeFont(filePath, resourceType, properties, parsed.extResources, parsed.subResources, loadFont);
}

/**
 * Routes on the fetched shape (raw bytes vs. text) so the processor's own
 * `process()` stays a two-line dispatcher. `path` is the full requested
 * ADDRESS (may carry a `::SubId`).
 *
 * `shouldProcess` does not pre-filter by extension (see `createFontProcessor`) —
 * EVERY address the font processor is asked to load ends up here, so this is
 * the one place that must never leave an address silently pending: a mistyped
 * ArrayBuffer throws instead of being accepted as "a font" (there is no
 * self-validating parse step for raw bytes, unlike text), and text always
 * reaches `createFontResourceFromContent`, whose own `[gd_resource]`-header
 * check throws for anything that isn't actually a `.tres` (a `.tscn`, a
 * script, …) rather than hanging forever.
 */
export async function buildFontResource(
  path: string,
  data: ArrayBuffer | string,
  loadFont: FontLoaderFn
): Promise<FontResource> {
  if (data instanceof ArrayBuffer) {
    if (!isFontContainerPath(path)) {
      // Also rejects the nonsensical "sub-resource address into a raw font
      // file" case for free: a raw font file declares no named internal
      // resources, and a `::SubId` suffix already breaks the extension match.
      throw new Error(`Not a recognised font file extension: ${path}`);
    }
    return fontResourceFromBytes(path, data);
  }
  const { filePath, subResourceId } = parseSubResourcePath(path);
  return createFontResourceFromContent(filePath, data, loadFont, subResourceId);
}
