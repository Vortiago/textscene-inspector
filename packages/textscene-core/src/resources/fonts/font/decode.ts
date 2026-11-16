/**
 * Font decode: one Font resource body in a file in, a `FontResource` out, for the font processor.
 * It and the `FONT` kind keep every non-identity property raw (see `types.ts`).
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { parsePackedStringArray } from '../../../parser/utils';
import { parsePackedByteArrayBody, readPackedByteArrayLiteral } from '../../../godot/variant/packedBytes';
import { extResourcePathsById, resolveRefToResourcePath, subResourceTypeGate } from '../../subResourcePath';
import type { FontLoaderFn, FontResource } from './types';

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

  if (!FONT_SUB_RESOURCE_TYPES.has(resourceType))
    throw new Error(`Unsupported font resource type: ${resourceType}`);
  const [fallbacks, baseFont] = await Promise.all([
    Promise.all(extractResourceRefs(properties['fallbacks'] ?? '').map(resolveRef)),
    resourceType === 'FontVariation' ? resolveRef(properties['base_font']) : null,
  ]);
  return fontResourceOf(
    resourceType,
    properties,
    fallbacks.filter((font) => font !== null),
    baseFont
  );
}

/**
 * The `FontResource` of a Font body of type `type`, one of {@link FONT_SUB_RESOURCE_TYPES}, with its
 * Font-valued properties already resolved. Both decode paths end here: this one for a file, and the
 * `FONT` kind for a Font built into a scene.
 */
export function fontResourceOf(
  type: string,
  properties: Readonly<Record<string, string>>,
  fallbacks: FontResource[],
  baseFont: FontResource | null
): FontResource {
  const { fallbacks: _fallbacks, ...rest } = properties;
  switch (type) {
    case 'SystemFont': {
      const { font_names, ...systemRest } = rest;
      return {
        kind: 'system',
        fontNames: font_names !== undefined ? (parsePackedStringArray(font_names) ?? []) : [],
        baseFont: null,
        fallbacks,
        properties: systemRest,
      };
    }
    case 'FontVariation': {
      const { base_font: _baseFont, ...variationRest } = rest;
      return { kind: 'variation', baseFont, fallbacks, properties: variationRest };
    }
    default: {
      const { data, ...fileRest } = rest;
      return {
        kind: 'file',
        bytes: embeddedFontBytes(data),
        mimeType: undefined,
        fallbacks,
        properties: fileRest,
      };
    }
  }
}

/** The font a `FontFile` holds in its `data` (`font.cpp:1052`). Undefined for a wrapper with none. */
function embeddedFontBytes(data: string | undefined): ArrayBuffer | undefined {
  if (data === undefined) return undefined;
  const literal = readPackedByteArrayLiteral(data);
  if (literal.fault !== null) return undefined;
  const bytes = parsePackedByteArrayBody(literal.body);
  return bytes && bytes.byteLength > 0 ? (bytes.slice().buffer as ArrayBuffer) : undefined;
}
