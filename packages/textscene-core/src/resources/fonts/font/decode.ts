/**
 * Font decode — one Font resource body (a `.tres`'s own `[resource]`, one of
 * its `[sub_resource]`s, or a scene's own inline `[sub_resource]`) in, a
 * `FontResource` out.
 *
 * Two entry points over one property-bag shape, because a Font arrives from
 * two scopes with two different ways of reaching its dependencies:
 *
 *   - `decodeFont` — the FILE-BACKED path. A Font-valued property resolves to
 *     a **Sub-resource path** address that the caller `await`s through the
 *     font loader, so this one is async.
 *   - `resolveInlineFontResource` — the SCENE-SCOPE path. A scene's own inline
 *     FontFile/SystemFont/FontVariation is never addressed through the loader
 *     (`parseTresFile` requires a `[gd_resource]` header, which a `.tscn`'s
 *     `[gd_scene]` is not): its `SubResource` refs name SIBLINGS of the same
 *     scene, decoded directly here, and its `ExtResource` refs are read off the
 *     already-populated font cache. Synchronous, because the solve walk that
 *     calls it cannot `await` mid-walk.
 *
 * Both keep every non-identity property raw — see `types.ts` for that contract.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { resolveRefToResourcePath, subResourceTypeGate } from '../../subResourcePath';
import type { FontCacheReader, FontLoaderFn, FontResource } from './types';

/** The three type names this slice claims — the gate both decode paths apply to a `SubResource` ref. */
export const FONT_SUB_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'FontFile',
  'SystemFont',
  'FontVariation',
]);

/**
 * Every `ExtResource(...)`/`SubResource(...)` reference literal inside a value —
 * covers both `fallbacks = Array[Font]([ExtResource("a"), ExtResource("b")])`
 * and a bare single reference the same regex matches as a one-element list.
 */
export function extractResourceRefs(value: string): string[] {
  const refs: string[] = [];
  const re = /(?:ExtResource|SubResource)\s*\(\s*"[^"]+"\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) refs.push(match[0]);
  return refs;
}

/**
 * `PackedStringArray("a", "b")` → `["a", "b"]`. Godot's own string-escape set,
 * matching `unquoteString`.
 */
export function parsePackedStringArray(value: string): string[] {
  const match = value.match(/^PackedStringArray\s*\(([\s\S]*)\)$/);
  if (!match) return [];
  const inner = match[1]!.trim();
  if (inner === '') return [];
  const strings: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    strings.push(m[1]!.replace(/\\(.)/g, '$1'));
  }
  return strings;
}

/**
 * Decode one file-backed Font resource body, recursing through `loadFont` for
 * any Font-valued property. `selfPath` is the address `SubResource`-valued
 * refs resolve against (`resolveRefToResourcePath`'s `res://file.tres::SubId`
 * form) — always the OWNING file, never the address currently being built.
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
 * Resolve a Font-valued reference found in THIS document's OWN scope —
 * `ExtResource` through the (possibly still-loading) font cache, `SubResource`
 * by decoding the sibling sub-resource directly, recursing for its own
 * `base_font`/`fallbacks` exactly as `decodeFont` does for a file-backed Font,
 * just synchronously instead of `await`ing. Both a Control's
 * `theme_override_fonts/<name>` and an inline Theme's `<Type>/fonts/<name>`
 * commonly reference one.
 *
 * An address not yet cached is pushed onto `pending` and treated as unresolved
 * for THIS pass; the caller requests it and the next pass — triggered once the
 * `font` processor's `loaded`/`failed` event bumps the generation — sees the
 * real value.
 */
export function resolveInlineFontResource(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  fontCache: FontCacheReader,
  pending: Set<string>
): FontResource | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed) return null;

  if (parsed.type === 'ExtResource') {
    const path = externalResources.find((r) => r.id === parsed.id)?.path;
    if (!path) return null;
    const cached = fontCache.getCached(path);
    if (cached === undefined) {
      pending.add(path);
      return null;
    }
    return cached;
  }

  const sub = findSubResource(internalResources, parsed.id);
  if (!sub) return null;
  // `parseInternalResource` echoes the heading's own `id` into `data` — strip
  // it back out, or it leaks into `properties` as a fake declared property.
  const { id: _id, ...properties } = sub.data as Record<string, string>;
  const resolveNested = (nestedRef: string | undefined): FontResource | null =>
    resolveInlineFontResource(nestedRef, externalResources, internalResources, fontCache, pending);

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
      // Not one of the three Font sub-resource types — the same gate
      // `subResourceTypeGate(FONT_SUB_RESOURCE_TYPES)` applies to the
      // file-backed path.
      return null;
  }
}
