/**
 * Font decode: one Font resource body in, a `FontResource` out, from a file or from a
 * scene's own scope. Both paths keep every non-identity property raw (see `types.ts`).
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { unquoteString } from '../../../parser/utils';
import { STRING_LITERAL_SOURCE } from '../../../godot/index.js';
import { findExtResource, findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { resolveRefToResourcePath, subResourceTypeGate } from '../../subResourcePath';
import type { FontCacheReader, FontLoaderFn, FontResource } from './types';

/** The three type names this slice claims: the gate both decode paths apply to a `SubResource` ref. */
export const FONT_SUB_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'FontFile',
  'SystemFont',
  'FontVariation',
]);

/**
 * Every `ExtResource(...)`/`SubResource(...)` reference literal inside a value, from
 * `fallbacks = Array[Font]([ExtResource("a"), ExtResource("b")])` or a bare single
 * reference, which comes back as a one-element list.
 */
export function extractResourceRefs(value: string): string[] {
  const refs: string[] = [];
  const re = /(?:ExtResource|SubResource)\s*\(\s*"[^"]+"\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) refs.push(match[0]);
  return refs;
}

/**
 * `PackedStringArray("a", "b")` → `["a", "b"]`, each element decoded as `unquoteString` decodes
 * it, so `\n` is a newline and not the letter `n`.
 */
export function parsePackedStringArray(value: string): string[] {
  const match = value.match(/^PackedStringArray\s*\(([\s\S]*)\)$/);
  if (!match) return [];
  const inner = match[1]!.trim();
  if (inner === '') return [];
  const strings: string[] = [];
  const re = new RegExp(STRING_LITERAL_SOURCE, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    strings.push(unquoteString(m[0]));
  }
  return strings;
}

/**
 * Decode one file-backed Font resource body, awaiting `loadFont` for each Font-valued
 * property. `selfPath` is the owning file that `SubResource` refs resolve against
 * (`resolveRefToResourcePath`'s `res://file.tres::SubId` form), never the address being built.
 */
export async function decodeFont(
  selfPath: string,
  resourceType: string,
  properties: Record<string, string>,
  extResources: readonly TscnExternalResource[],
  subResources: readonly TscnInternalResource[],
  loadFont: FontLoaderFn
): Promise<FontResource> {
  const extPathById = new Map(extResources.map((r) => [r.id, r.path]));
  const gate = subResourceTypeGate(subResources, FONT_SUB_RESOURCE_TYPES);

  const resolveRef = async (ref: string | undefined): Promise<FontResource | null> => {
    const address = resolveRefToResourcePath(ref, extPathById, selfPath, gate);
    return address ? loadFont(address) : null;
  };

  switch (resourceType) {
    case 'SystemFont': {
      const { font_names, ...rest } = properties;
      return {
        kind: 'system',
        fontNames: font_names !== undefined ? parsePackedStringArray(font_names) : [],
        properties: rest,
      };
    }

    case 'FontVariation': {
      const { base_font, ...rest } = properties;
      const baseFont = await resolveRef(base_font);
      return { kind: 'variation', baseFont, properties: rest };
    }

    case 'FontFile': {
      const { fallbacks, ...rest } = properties;
      const fallbackRefs = fallbacks !== undefined ? extractResourceRefs(fallbacks) : [];
      const resolved = await Promise.all(fallbackRefs.map((ref) => resolveRef(ref)));
      return {
        kind: 'file',
        bytes: undefined,
        mimeType: undefined,
        fallbacks: resolved.filter((f): f is FontResource => f !== null),
        properties: rest,
      };
    }

    default:
      throw new Error(`Unsupported font resource type: ${resourceType}`);
  }
}

/**
 * Resolve a Font reference in a scene's own scope, synchronously, since the solve walk
 * cannot await: `ExtResource` through the font cache, and `SubResource` by decoding the
 * sibling as `decodeFont` does. The loader cannot serve it: `parseTresFile` requires a
 * `[gd_resource]` header, which a `.tscn` lacks.
 */
export function resolveInlineFontResource(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  fontCache: FontCacheReader,
  pending: Set<string>,
  /**
   * SubResource ids already on this walk. `base_font`/`fallbacks` can name a sibling
   * that names them back, and this resolver runs inside the Control rect solve, so an
   * unguarded cycle blows the stack out of a React render.
   */
  visiting: ReadonlySet<string> = new Set()
): FontResource | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed) return null;

  if (parsed.type === 'ExtResource') {
    const path = findExtResource(externalResources, parsed.id)?.path;
    if (!path) return null;
    const cached = fontCache.getCached(path);
    if (cached === undefined) {
      // Unresolved for this pass. The caller requests it, and the pass after the
      // `font` processor's `loaded`/`failed` event sees the value.
      pending.add(path);
      return null;
    }
    return cached;
  }

  if (visiting.has(parsed.id)) return null;
  const sub = findSubResource(internalResources, parsed.id);
  if (!sub) return null;
  const nowVisiting = new Set(visiting).add(parsed.id);
  // `parseInternalResource` echoes the heading's own `id` into `data`. Strip it, or
  // it leaks into `properties` as a fake declared property.
  const { id: _id, ...properties } = sub.data as Record<string, string>;
  const resolveNested = (nestedRef: string | undefined): FontResource | null =>
    resolveInlineFontResource(
      nestedRef,
      externalResources,
      internalResources,
      fontCache,
      pending,
      nowVisiting
    );

  switch (sub.type) {
    case 'SystemFont': {
      const { font_names, ...rest } = properties;
      return {
        kind: 'system',
        fontNames: font_names !== undefined ? parsePackedStringArray(font_names) : [],
        properties: rest,
      };
    }
    case 'FontVariation': {
      const { base_font, ...rest } = properties;
      return { kind: 'variation', baseFont: resolveNested(base_font), properties: rest };
    }
    case 'FontFile': {
      const { fallbacks, ...rest } = properties;
      const refs = fallbacks !== undefined ? extractResourceRefs(fallbacks) : [];
      const resolved = refs.map(resolveNested).filter((f): f is FontResource => f !== null);
      return { kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: resolved, properties: rest };
    }
    default:
      // Not a Font sub-resource type: the gate the file-backed path applies through
      // `subResourceTypeGate(FONT_SUB_RESOURCE_TYPES)`.
      return null;
  }
}
