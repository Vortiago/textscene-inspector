/**
 * Font decode: one Font resource body in, a `FontResource` out, from a file or from a
 * scene's own scope. Both paths keep every non-identity property raw (see `types.ts`).
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { unquoteString } from '../../../parser/utils';
import { stringArrayBodies } from '../../../godot/variant/variantParser.js';
import { findExtResource, findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { extResourcePathsById, resolveRefToResourcePath, subResourceTypeGate } from '../../subResourcePath';
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
function extractResourceRefs(value: string): string[] {
  const refs: string[] = [];
  const re = /(?:ExtResource|SubResource)\s*\(\s*"[^"]+"\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) refs.push(match[0]);
  return refs;
}

/**
 * `PackedStringArray("a", "b")`, `Array[String](["a", "b"])` or `["a", "b"]` → `["a", "b"]`, each element decoded as
 * `unquoteString` decodes it, so `\n` is a newline and not the letter `n`. Empty for any other value.
 */
function parsePackedStringArray(value: string): string[] {
  return stringArrayBodies(value)?.map(unquoteString) ?? [];
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
  const extPathById = extResourcePathsById(extResources);
  const gate = subResourceTypeGate(subResources, FONT_SUB_RESOURCE_TYPES);

  const resolveRef = async (ref: string | undefined): Promise<FontResource | null> => {
    const address = resolveRefToResourcePath(ref, extPathById, selfPath, gate);
    return address ? loadFont(address) : null;
  };

  const fallbacks = await Promise.all(extractResourceRefs(properties['fallbacks'] ?? '').map(resolveRef));
  const baseFont = resourceType === 'FontVariation' ? await resolveRef(properties['base_font']) : null;
  if (!FONT_SUB_RESOURCE_TYPES.has(resourceType))
    throw new Error(`Unsupported font resource type: ${resourceType}`);
  return fontResourceOf(resourceType, properties, nonNull(fallbacks), baseFont);
}

const nonNull = (fonts: readonly (FontResource | null)[]): FontResource[] =>
  fonts.filter((font): font is FontResource => font !== null);

/**
 * The `FontResource` of a Font body of type `type`, one of {@link FONT_SUB_RESOURCE_TYPES}, with its
 * Font-valued properties already resolved. Both decode paths end here.
 */
function fontResourceOf(
  type: string,
  properties: Record<string, string>,
  fallbacks: FontResource[],
  baseFont: FontResource | null
): FontResource {
  const { fallbacks: _fallbacks, ...rest } = properties;
  switch (type) {
    case 'SystemFont': {
      const { font_names, ...systemRest } = rest;
      return {
        kind: 'system',
        fontNames: font_names !== undefined ? parsePackedStringArray(font_names) : [],
        baseFont: null,
        fallbacks,
        properties: systemRest,
      };
    }
    case 'FontVariation': {
      const { base_font: _baseFont, ...variationRest } = rest;
      return { kind: 'variation', baseFont, fallbacks, properties: variationRest };
    }
    default:
      return { kind: 'file', bytes: undefined, mimeType: undefined, fallbacks, properties: rest };
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
  const resolveNested = (nestedRef: string | undefined): FontResource | null =>
    resolveInlineFontResource(
      nestedRef,
      externalResources,
      internalResources,
      fontCache,
      pending,
      nowVisiting
    );

  // Not a Font sub-resource type: the gate the file-backed path applies through
  // `subResourceTypeGate(FONT_SUB_RESOURCE_TYPES)`.
  if (!FONT_SUB_RESOURCE_TYPES.has(sub.type)) return null;
  const fallbacks = nonNull(extractResourceRefs(sub.data['fallbacks'] ?? '').map(resolveNested));
  const baseFont = sub.type === 'FontVariation' ? resolveNested(sub.data['base_font']) : null;
  return fontResourceOf(sub.type, sub.data, fallbacks, baseFont);
}
