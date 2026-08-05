/**
 * Pure functions for font processing — the `.tres`/raw-file → `FontResource`
 * builder used by `createFontProcessor`.
 *
 * Godot has three font resource types, and the corpus uses every one:
 *
 *   - `FontFile` — most often an `ExtResource` pointing straight at a raw
 *     `.ttf`/`.otf`/`.woff`/`.woff2` (no `.tres` involved at all, exactly like
 *     an image `Texture2D`). Less often a `.tres` wrapper that carries no font
 *     bytes of its own and instead lists `fallbacks` — other Fonts, most
 *     commonly the real face — plus Godot's own dynamic-font bake settings
 *     (`msdf_*`, `cache/*`) this previewer does not consume.
 *   - `SystemFont` — no file at all: `font_names` is a list of OS family names
 *     (`"sans-serif"`, `"monospace"`, …) resolved by the OS at runtime, which
 *     a previewer with no access to the user's system fonts cannot honour by
 *     loading bytes.
 *   - `FontVariation` — wraps a `base_font` (any of the three kinds,
 *     recursively) plus synthesis/spacing/OpenType-feature overrides. Not
 *     every `FontVariation` sets `base_font`: one in the corpus omits it
 *     entirely, meaning "the theme's own default font."
 *
 * `resolveFontResource` decodes the identity-relevant fields — `base_font`,
 * `fallbacks`, `font_names` — into a recursively-resolved `FontResource`
 * graph, and keeps everything else (`spacing_*`, `embolden`,
 * `opentype_features`, `variation_opentype`, `msdf_*`, …) as raw property
 * strings for a future consumer, the same shallow-decode contract
 * `materialProcessing.ts` and the mesh-library/tileset resolvers use.
 */

import type { ParsedTresFile } from '../../parser/tresParser';
import { parseTresFile } from '../../parser/tresParser';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { findSubResource } from '../SubResourceResolver';
import { parseSubResourcePath, resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath';

/** A `FontFile` .tres wrapper has no bytes of its own — it defers to `fallbacks`. */
export interface FontFileResource {
  kind: 'file';
  /** Raw font bytes, ready for `new FontFace(name, bytes)`. Undefined for a bytes-less `.tres` wrapper. */
  bytes: ArrayBuffer | undefined;
  /** Undefined when `bytes` is undefined. */
  mimeType: string | undefined;
  /** Other Fonts to try, in order — usually the one real face behind a `.tres` wrapper. */
  fallbacks: FontResource[];
  /** Every other declared property (`msdf_*`, `subpixel_positioning`, `cache/*`, …), raw. */
  properties: Record<string, string>;
}

/** No file: `font_names` are OS family names resolved at runtime, which this previewer cannot load bytes for. */
export interface SystemFontResource {
  kind: 'system';
  fontNames: string[];
  properties: Record<string, string>;
}

/** Wraps another Font (or none — the theme default) with synthesis/spacing/feature overrides. */
export interface FontVariationResource {
  kind: 'variation';
  baseFont: FontResource | null;
  /** `spacing_*`, `embolden`, `opentype_features`, `variation_opentype`, …, raw. */
  properties: Record<string, string>;
}

export type FontResource = FontFileResource | SystemFontResource | FontVariationResource;

/** Loads a Font by `res://` path (or `res://file.tres::SubId` address); null on failure. */
export type FontLoaderFn = (address: string) => Promise<FontResource | null>;

const FONT_FILE_EXTENSIONS: ReadonlySet<string> = new Set(['ttf', 'otf', 'woff', 'woff2']);

const FONT_MIME_TYPES: Record<string, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

function extensionOf(path: string): string | undefined {
  return path.split('.').pop()?.toLowerCase();
}

/** A raw binary font file — the shape a `FontFile` `ExtResource` overwhelmingly takes in the corpus. */
export function isFontFilePath(path: string): boolean {
  const ext = extensionOf(path);
  return ext !== undefined && FONT_FILE_EXTENSIONS.has(ext);
}

export function getFontMimeType(path: string): string | undefined {
  const ext = extensionOf(path);
  return ext !== undefined ? FONT_MIME_TYPES[ext] : undefined;
}

/** Matches both fetch shapes a font-typed address can resolve to: a raw font file, or a `.tres` wrapper/carrier. */
export function isFontPath(path: string): boolean {
  return isFontFilePath(path) || path.endsWith('.tres');
}

/** A raw font file's bytes need no parsing — they ARE the resource. */
export function fontResourceFromBytes(path: string, bytes: ArrayBuffer): FontFileResource {
  return { kind: 'file', bytes, mimeType: getFontMimeType(path), fallbacks: [], properties: {} };
}

const FONT_SUB_RESOURCE_TYPES: ReadonlySet<string> = new Set(['FontFile', 'SystemFont', 'FontVariation']);

/**
 * Every `ExtResource(...)`/`SubResource(...)` reference literal inside a value —
 * covers both `fallbacks = Array[Font]([ExtResource("a"), ExtResource("b")])`
 * and a bare single reference the same regex matches as a one-element list.
 */
function extractResourceRefs(value: string): string[] {
  const refs: string[] = [];
  const re = /(?:ExtResource|SubResource)\s*\(\s*"[^"]+"\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) refs.push(match[0]);
  return refs;
}

/** `PackedStringArray("a", "b")` → `["a", "b"]`. Godot's own string-escape set, matching `unquoteString`. */
function parsePackedStringArray(value: string): string[] {
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
 * Decode one Font resource body (a `.tres`'s own `[resource]`, or one of its
 * `[sub_resource]`s) into a `FontResource`, recursing through `loadFont` for
 * any Font-valued property. `selfPath` is the address `SubResource`-valued
 * refs resolve against (`resolveRefToResourcePath`'s `res://file.tres::SubId`
 * form) — always the OWNING file, never the address currently being built.
 */
export async function resolveFontResource(
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
 * Build a `FontResource` from a `.tres`'s text content — either its own
 * `[resource]` body (`subResourceId` absent) or a named `[sub_resource]`
 * inside it (a `.tres` that carries more than one Font — e.g. a shared
 * fonts-library file). `content` must carry a `[gd_resource]` header
 * (`parseTresFile`'s requirement); a scene's OWN inline
 * FontFile/SystemFont/FontVariation sub-resource is never addressed this
 * way — it resolves synchronously against the scene's own parsed
 * SubResources (`useSceneResources`), the same path every other node-local
 * SubResource takes, never through the resource event bus.
 */
export async function createFontResourceFromContent(
  filePath: string,
  content: string,
  loadFont: FontLoaderFn,
  subResourceId?: string
): Promise<FontResource> {
  const parsed: ParsedTresFile = parseTresFile(content);

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

  return resolveFontResource(filePath, resourceType, properties, parsed.extResources, parsed.subResources, loadFont);
}

/**
 * The one entry point `createFontProcessor` calls: routes on the fetched
 * shape (raw bytes vs. text) so the processor's own `process()` stays a
 * two-line dispatcher. `path` is the full requested ADDRESS (may carry a
 * `::SubId`).
 *
 * `shouldProcess` no longer pre-filters by extension (see `createFontProcessor`) —
 * EVERY address the font processor is asked to load ends up here, so this is
 * the one place that must never leave an address silently pending: a
 * mistyped ArrayBuffer throws instead of being accepted as "a font" (there is
 * no self-validating parse step for raw bytes, unlike text), and text always
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
    if (!isFontFilePath(path)) {
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
