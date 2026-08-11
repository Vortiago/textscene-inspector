/**
 * Pure functions for Theme processing — the `.tres` → `ThemeResource`
 * builder used by `createThemeProcessor`, plus the ancestor-walk font lookup
 * every text-bearing Control's painter will eventually read a resolved
 * font/font-size off of.
 *
 * A Godot `Theme` `.tres` carries StyleBoxes, colors, constants, icons, font
 * sizes and fonts, keyed by `<Type>/<data_type>/<name>`
 * (`Theme::_set`/`_get`, `scene/resources/theme.cpp:36-104`: the property name
 * splits on `/` into `theme_type` / `data_type` / `prop_name`) plus a handful
 * of un-prefixed scalars (`default_font`, `default_font_size`) and
 * `<variationType>/base_type` type-variation declarations. This module
 * decodes only what a font lookup needs — `default_font`,
 * `default_font_size`, `<Type>/fonts/<name>`, `<Type>/font_sizes/<name>`, and
 * `<variationType>/base_type` — into typed values, recursively resolving Font
 * references through the existing font loader exactly as
 * `fontProcessing.resolveFontResource` does for `base_font`/`fallbacks`.
 * Everything else (styles, colors, constants, icons) stays a raw property
 * string for a future consumer, the same shallow-decode contract
 * `materialProcessing.ts` and `fontProcessing.ts` already use.
 *
 * Two decode paths, one shared scan (`scanTheme`): a FILE-BACKED `.tres`
 * decodes to `ThemeAddresses` (font refs left as loader addresses,
 * `resolveThemeResource` awaits them), a scene's own inline
 * `[sub_resource type="Theme"]` decodes straight to a `ThemeResource`
 * (`resolveInlineThemeResource`, synchronous — `buildSolveTree.ts` cannot
 * `await` mid-walk).
 */

import type { ParsedResource } from '../../parser/parsedResource';
import { parseTresFile } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { unquoteStringName } from '../../parser/utils';
import { parseOptionalFloat } from '../../parser/valueParsers';
import { NODE_BASE_TYPES } from '../../linter/nodeBaseTypes';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { parseSubResourcePath, resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath';
import {
  extractResourceRefs,
  parsePackedStringArray,
  type FontLoaderFn,
  type FontResource,
} from './fontProcessing';

/** The Font sub-resource types a Theme's `default_font`/`<Type>/fonts/<name>` can point at — same set `fontProcessing.ts` resolves. */
const FONT_SUB_RESOURCE_TYPES: ReadonlySet<string> = new Set(['FontFile', 'SystemFont', 'FontVariation']);

/** `<Type>/fonts/<name>`. */
const FONT_ENTRY = /^([^/]+)\/fonts\/([^/]+)$/;
/** `<Type>/font_sizes/<name>`. */
const FONT_SIZE_ENTRY = /^([^/]+)\/font_sizes\/([^/]+)$/;
/** `<variationType>/base_type`. */
const BASE_TYPE_ENTRY = /^([^/]+)\/base_type$/;

/**
 * The shape both a file-backed Theme (`T` = address string, resolved later
 * by awaiting the loader) and a scene-inline one (`T` = `FontResource`,
 * resolved immediately by reading scope) decode to. `ThemeAddresses` and
 * `ThemeResource` below are this shape at each of those two `T`s.
 */
interface ScannedTheme<T> {
  defaultFont: T | null;
  defaultFontSize: number | undefined;
  fonts: Readonly<Record<string, Readonly<Record<string, T>>>>;
  fontSizes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  typeVariations: Readonly<Record<string, string>>;
  properties: Readonly<Record<string, string>>;
}

/**
 * Walk one Theme resource body's properties, resolving every Font-valued one
 * (`default_font`, `<Type>/fonts/<name>`) through `resolveRef` — the ONE
 * `<Type>/<data_type>/<name>` scanning loop (`Theme::_set`/`_get`,
 * `scene/resources/theme.cpp:36-104`) shared by the file-backed path
 * (`resolveRef` synthesises an ADDRESS, awaited later by `resolveThemeResource`)
 * and the scene-inline path (`resolveRef` resolves against scope immediately,
 * via `resolveInlineFontResource`) — so the regex/property-walking logic
 * exists exactly once. `resolveRef` returning `null` (an absent/malformed ref,
 * OR — for the inline path — one that failed to resolve) omits the entry,
 * matching `Theme::has_font`'s `Ref<Font>::is_valid()` gate
 * (`scene/resources/theme.cpp:549-552`): a Theme can never distinguish
 * "explicitly nothing" from "never set" at this level. This collapse is
 * specific to fonts/font-sizes — colors, constants and styles (kept raw here)
 * do NOT share it.
 */
function scanTheme<T>(
  properties: Record<string, string>,
  resolveRef: (ref: string) => T | null
): ScannedTheme<T> {
  const fonts: Record<string, Record<string, T>> = {};
  const fontSizes: Record<string, Record<string, number>> = {};
  const typeVariations: Record<string, string> = {};
  const rest: Record<string, string> = {};

  let defaultFont: T | null = null;
  let defaultFontSize: number | undefined;

  for (const [key, value] of Object.entries(properties)) {
    if (key === 'default_font') {
      defaultFont = resolveRef(value);
      continue;
    }
    if (key === 'default_font_size') {
      const n = parseOptionalFloat(value);
      if (n !== undefined && n > 0) defaultFontSize = n;
      continue;
    }

    const fontMatch = key.match(FONT_ENTRY);
    if (fontMatch) {
      const [, type, name] = fontMatch;
      const resolved = resolveRef(value);
      if (resolved !== null) (fonts[type!] ??= {})[name!] = resolved;
      continue;
    }

    const sizeMatch = key.match(FONT_SIZE_ENTRY);
    if (sizeMatch) {
      const [, type, name] = sizeMatch;
      const n = parseOptionalFloat(value);
      if (n !== undefined && n > 0) (fontSizes[type!] ??= {})[name!] = n;
      continue;
    }

    const baseMatch = key.match(BASE_TYPE_ENTRY);
    if (baseMatch) {
      const [, variation] = baseMatch;
      const base = unquoteStringName(value);
      if (base !== '') typeVariations[variation!] = base;
      continue;
    }

    rest[key] = value;
  }

  return { defaultFont, defaultFontSize, fonts, fontSizes, typeVariations, properties: rest };
}

/**
 * A Theme's font-relevant data, decoded to typed values but with every Font
 * reference left as a **Sub-resource path** ADDRESS rather than a resolved
 * `FontResource` — the seam between the format-decode (`scanTheme`) and
 * `resolveThemeResource`, which awaits the loader for each one. Used for a
 * FILE-BACKED Theme only; a scene-inline one resolves straight to a
 * `ThemeResource` via `resolveInlineThemeResource` instead (see there for why).
 */
export type ThemeAddresses = ScannedTheme<string>;

/**
 * Decode one Theme resource body (a `.tres`'s own `[resource]`, or one of its
 * `[sub_resource]`s) into `ThemeAddresses`. Pure and synchronous — no I/O.
 * `selfPath` is the address a `SubResource`-valued font ref resolves against
 * (`resolveRefToResourcePath`'s `res://file.tres::SubId` form) — always the
 * OWNING `.tres`, never the Theme's own address.
 */
export function decodeThemeAddresses(
  selfPath: string,
  properties: Record<string, string>,
  extResources: readonly TscnExternalResource[],
  subResources: readonly TscnInternalResource[]
): ThemeAddresses {
  const extPathById = new Map(extResources.map((r) => [r.id, r.path]));
  const gate = subResourceTypeGate(subResources, FONT_SUB_RESOURCE_TYPES);
  return scanTheme(properties, (ref) => resolveRefToResourcePath(ref, extPathById, selfPath, gate));
}

/** A Theme, decoded to the point a font lookup can use it: every Font reference resolved to a `FontResource`, everything else still raw. See `scanTheme`'s doc for the validity-collapse this shares with `ThemeAddresses`. */
export type ThemeResource = ScannedTheme<FontResource>;

/**
 * Resolve `ThemeAddresses` into a `ThemeResource` by awaiting `loadFont` for
 * every address — the file-backed path (`createThemeProcessor`, via
 * `buildThemeResource`), which already runs inside an async `process()` step.
 */
export async function resolveThemeResource(
  addresses: ThemeAddresses,
  loadFont: FontLoaderFn
): Promise<ThemeResource> {
  const resolveFont = async (address: string | null): Promise<FontResource | null> =>
    address ? loadFont(address) : null;

  const defaultFont = await resolveFont(addresses.defaultFont);

  const fonts: Record<string, Record<string, FontResource>> = {};
  await Promise.all(
    Object.entries(addresses.fonts).map(async ([type, byName]) => {
      const resolvedByName: Record<string, FontResource> = {};
      await Promise.all(
        Object.entries(byName).map(async ([name, address]) => {
          const font = await loadFont(address);
          if (font) resolvedByName[name] = font;
        })
      );
      if (Object.keys(resolvedByName).length) fonts[type] = resolvedByName;
    })
  );

  return {
    defaultFont,
    defaultFontSize: addresses.defaultFontSize,
    fonts,
    fontSizes: addresses.fontSizes,
    typeVariations: addresses.typeVariations,
    properties: addresses.properties,
  };
}

/** Reads a Font by address off the SAME cache `loader.fonts` populates — no I/O of its own. */
export interface FontCacheReader {
  getCached(address: string): FontResource | null | undefined;
}

/**
 * Resolve a Font-valued reference found in THIS document's OWN scope —
 * `ExtResource` through the (possibly still-loading) `loader.fonts` cache,
 * `SubResource` by decoding the sibling sub-resource directly, recursing for
 * its own `base_font`/`fallbacks` exactly as `fontProcessing.resolveFontResource`
 * decodes a file-backed Font's, just synchronously instead of `await`ing.
 * This is the path `fontProcessing.ts`'s own header says a scene's inline
 * FontFile/SystemFont/FontVariation sub-resource takes ("never addressed
 * [through the loader] — it resolves synchronously against the scene's own
 * parsed SubResources") — needed here because BOTH a Control's
 * `theme_override_fonts/<name>` and an inline Theme's `<Type>/fonts/<name>`
 * commonly reference one (`scenes/demos/gui/bidi_and_font_features/bidi.tscn`
 * alone declares 16 such node-local overrides).
 *
 * An address not yet cached is pushed onto `pending` (mirrors
 * `resolveTextureSize`'s cache-read + pending-collection in
 * `buildSolveTree.ts`) and treated as unresolved for THIS pass; the caller
 * requests it and the next pass — triggered once the `font` processor's
 * `loaded`/`failed` event bumps `generation` — sees the real value.
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
      // Not one of the three Font sub-resource types — same gate
      // `subResourceTypeGate(FONT_SUB_RESOURCE_TYPES)` applies to the
      // file-backed path.
      return null;
  }
}

/**
 * Resolve a scene's own inline `[sub_resource type="Theme"]` straight to a
 * `ThemeResource`, in one synchronous pass — `buildSolveTree.ts` cannot
 * `await` mid-walk, and (unlike a file-backed `.tres`) there is no
 * address-then-load split to make: a `SubResource`-valued font ref inside an
 * inline Theme addresses a SIBLING sub-resource of the SAME scene, which
 * `resolveInlineFontResource` reads directly rather than routing through
 * `loader.fonts` — a `res://scene.tscn::SubId` address could never resolve
 * there anyway (`parseTresFile` requires a `[gd_resource]` header; a scene's
 * own `[gd_scene]` header throws).
 */
export function resolveInlineThemeResource(
  properties: Record<string, string>,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  fontCache: FontCacheReader,
  pending: Set<string>
): ThemeResource {
  return scanTheme(properties, (ref) =>
    resolveInlineFontResource(ref, externalResources, internalResources, fontCache, pending)
  );
}

/**
 * Build a `ThemeResource` from a `.tres`'s text content — either its own
 * `[resource]` body (`subResourceId` absent) or a named `[sub_resource]`
 * inside it. `content` must carry a `[gd_resource]` header (`parseTresFile`'s
 * requirement).
 */
export async function createThemeResourceFromContent(
  filePath: string,
  content: string,
  loadFont: FontLoaderFn,
  subResourceId?: string
): Promise<ThemeResource> {
  const parsed: ParsedResource = parseTresFile(content);

  let properties: Record<string, string>;

  if (subResourceId !== undefined) {
    const sub = findSubResource(parsed.subResources, subResourceId);
    if (!sub) {
      throw new Error(`Sub-resource "${subResourceId}" is not declared in ${filePath}`);
    }
    if (sub.type !== 'Theme') {
      throw new Error(`Not a Theme resource: ${sub.type} (${filePath})`);
    }
    // `parseInternalResource` echoes the heading's own `id` into `data` — strip
    // it back out, or it leaks into `properties` as a fake declared property.
    const { id: _id, ...rest } = sub.data as Record<string, string>;
    properties = rest;
  } else {
    if (parsed.resourceType !== 'Theme') {
      throw new Error(`Not a Theme resource: ${parsed.resourceType} (${filePath})`);
    }
    properties = parsed.properties;
  }

  const addresses = decodeThemeAddresses(filePath, properties, parsed.extResources, parsed.subResources);
  return resolveThemeResource(addresses, loadFont);
}

/**
 * The one entry point `createThemeProcessor` calls. Unlike a Font, a Theme is
 * ALWAYS `.tres` text — never raw bytes — so there is no ArrayBuffer branch;
 * `shouldProcess` gates on that upstream. `path` is the full requested
 * ADDRESS (may carry a `::SubId`).
 */
export async function buildThemeResource(
  path: string,
  content: string,
  loadFont: FontLoaderFn
): Promise<ThemeResource> {
  const { filePath, subResourceId } = parseSubResourcePath(path);
  return createThemeResourceFromContent(filePath, content, loadFont, subResourceId);
}

// ---------------------------------------------------------------------------
// The theme-item lookup — Godot's ancestor + type-dependency walk for a Font.
// ---------------------------------------------------------------------------

/** This node's real Godot class name, then its `NODE_BASE_TYPES` ancestry — the native-inheritance half of the type-dependency chain. */
/**
 * Memoised: a pure function of one type name over the fixed, small
 * `NODE_BASE_TYPES` table, called for every Control on every theme lookup.
 * The returned array is shared, so callers must not mutate it — the one
 * consumer (`buildThemeTypeChain`) spreads it into a fresh array.
 */
const nativeTypeChainCache = new Map<string, readonly string[]>();

function nativeTypeChain(nativeType: string): readonly string[] {
  const cached = nativeTypeChainCache.get(nativeType);
  if (cached) return cached;

  const chain: string[] = [nativeType];
  let base: string | undefined = NODE_BASE_TYPES[nativeType];
  while (base !== undefined) {
    chain.push(base);
    base = NODE_BASE_TYPES[base];
  }
  nativeTypeChainCache.set(nativeType, chain);
  return chain;
}

function themeSearchOrder(
  ancestorThemes: readonly ThemeResource[],
  projectTheme: ThemeResource | null
): readonly ThemeResource[] {
  return projectTheme ? [...ancestorThemes, projectTheme] : ancestorThemes;
}

/**
 * `Theme::get_type_dependencies` (`scene/resources/theme.cpp:1404-1419`): the
 * type names one item lookup tries, in order. When `typeVariation` is set,
 * walk `base_type` links declared on whichever ancestor/project theme is the
 * FIRST (nearest ancestor first, project last) to register the variation as
 * its own key — mirrors `ThemeOwner::get_theme_type_dependencies`'s "First,
 * look through themes owned by nodes in the tree... second, check global
 * contexts" search (`scene/theme/theme_owner.cpp:181-224`) — up to (not
 * including) `nativeType`, then the native inheritance chain is appended
 * UNCONDITIONALLY regardless of whether the variation walk found anything.
 *
 * `NODE_BASE_TYPES` (`linter/nodeBaseTypes.ts`) stands in for Godot's full
 * `ClassDB` inheritance (`ThemeDB::get_native_type_dependencies`) — theme
 * items are only ever registered at `Control` or below, so the collapse this
 * previewer already uses for linter validator inheritance costs nothing here
 * either.
 */
export function buildThemeTypeChain(
  nativeType: string,
  typeVariation: string | undefined,
  ancestorThemes: readonly ThemeResource[],
  projectTheme: ThemeResource | null
): string[] {
  const chain: string[] = [];

  if (typeVariation) {
    const owner = themeSearchOrder(ancestorThemes, projectTheme).find(
      (t) => typeVariation in t.typeVariations
    );
    if (owner) {
      let current: string | undefined = typeVariation;
      while (current !== undefined && current !== '') {
        chain.push(current);
        const base: string | undefined = owner.typeVariations[current];
        current = base;
        if (current === nativeType) break;
      }
    }
  }

  return [...chain, ...nativeTypeChain(nativeType)];
}

/**
 * One ancestor Theme's answer for `<name>` at `<type>` —
 * `Theme::has_theme_item`'s FONT branch (`scene/resources/theme.cpp:1009-1030`):
 * an explicit, valid `<type>/fonts/<name>` always wins; otherwise, UNLESS
 * `type` is itself a variation registered in THIS theme
 * (`has_font_no_default` — a variation type never inherits the whole-theme
 * default), fall back to this theme's own `default_font`. `undefined` means
 * "this theme has nothing for `type`", the caller's signal to keep walking.
 */
function fontInTheme(theme: ThemeResource, type: string, name: string): FontResource | undefined {
  const explicit = theme.fonts[type]?.[name];
  if (explicit !== undefined) return explicit;
  if (type in theme.typeVariations) return undefined;
  return theme.defaultFont ?? undefined;
}

/** The font-size counterpart of `fontInTheme` (`Theme::has_theme_item`'s FONT_SIZE branch, same file/lines). */
function fontSizeInTheme(theme: ThemeResource, type: string, name: string): number | undefined {
  const explicit = theme.fontSizes[type]?.[name];
  if (explicit !== undefined) return explicit;
  if (type in theme.typeVariations) return undefined;
  return theme.defaultFontSize;
}

/**
 * The part of a theme lookup that does NOT depend on which item is being
 * looked up: the type-dependency chain and the ordered list of themes to
 * search. Both are functions of the NODE alone (its native type, its
 * `theme_type_variation`, its ancestor themes, the project theme) — never of
 * the item name — so a node that resolves a font AND a font size, from both
 * the solve pass and the paint pass, can build this once and do four cheap
 * leaf lookups against it instead of rebuilding these two arrays four times.
 */
export interface ThemeResolutionScope {
  readonly typeChain: readonly string[];
  readonly searchOrder: readonly ThemeResource[];
}

export function themeResolutionScope(
  nativeType: string,
  typeVariation: string | undefined,
  ancestorThemes: readonly ThemeResource[],
  projectTheme: ThemeResource | null
): ThemeResolutionScope {
  return {
    typeChain: buildThemeTypeChain(nativeType, typeVariation, ancestorThemes, projectTheme),
    searchOrder: themeSearchOrder(ancestorThemes, projectTheme),
  };
}

/**
 * A Control's resolved theme font — Godot's ancestor + type-chain walk
 * (`Control::get_theme_font`, `ThemeOwner::get_theme_item_in_types`;
 * `scene/gui/control.cpp:3083-3103`, `scene/theme/theme_owner.cpp:227-254`):
 *
 *  1. the node's OWN `theme_override_fonts/<name>` — wins UNCONDITIONALLY
 *     once declared, valid or not: `Control::get_theme_font`'s local-override
 *     branch (`control.cpp:3089-3093`) returns whatever is stored with no
 *     validity check, unlike every ancestor Theme below. `override` encodes
 *     this: `undefined` = not authored (keep walking), `null` = authored but
 *     invalid/unresolved (STOP, resolve to no font), a `FontResource` = the
 *     override itself.
 *  2. `ancestorThemes` (nearest Control-with-a-theme first — this node's own
 *     `theme` is index 0 if it has one; a Control ancestor with NO `theme`
 *     contributes no entry, mirroring `ThemeOwner::_get_next_owner_node`
 *     skipping non-owning nodes) then `projectTheme`
 *     (`gui/theme/custom`) — for each, for every type in the
 *     variation/native-inheritance chain, in order (themes outer, types
 *     inner — `theme_owner.cpp:236-245`'s loop nesting; a theme with ANY
 *     `default_font` therefore SHADOWS a more specific `<baseType>/fonts/<name>`
 *     entry on a farther ancestor, because it wins on the nearer type before
 *     the farther type is ever tried).
 *  3. `null` — nothing anywhere defines it. This previewer has no literal
 *     built-in-default FONT RESOURCE (only a default SIZE, see
 *     `resolveThemeFontSizeIn`); `null` is the signal a painter renders its
 *     own bundled default face for.
 *
 * "Resolved" is deliberately NOT "usable". This answers what Godot would
 * resolve, faithfully — and Godot considers a `SystemFont` a perfectly valid
 * Font, because the OS resolves the family name at draw time. Only this
 * previewer, in a browser with no access to the host's installed fonts,
 * cannot fetch bytes for one. Folding that limitation into the walk would
 * make it stop early and skip a FARTHER ancestor that might have resolved to
 * something drawable, which is not what Godot does. Whether the result
 * carries drawable bytes is a separate predicate the painter applies:
 * `resolveFontFileBytes` (`r3f/controls/native/text/sceneFontResolution.ts`),
 * which walks `fallbacks`/`baseFont` — Godot's own "try the next one" chain —
 * and returns the leaf actually carrying bytes, not necessarily the root.
 */
export function resolveThemeFontIn(
  scope: ThemeResolutionScope,
  name: string,
  override: FontResource | null | undefined
): FontResource | null {
  if (override !== undefined) return override;

  for (const theme of scope.searchOrder) {
    for (const type of scope.typeChain) {
      const found = fontInTheme(theme, type, name);
      if (found !== undefined) return found;
    }
  }
  return null;
}

/**
 * The font-size counterpart of `resolveThemeFontIn`
 * (`Control::get_theme_font_size`, `control.cpp:3107-3129`). Godot's local
 * override ALSO requires `> 0` (`if (font_size && (*font_size) > 0)`,
 * `control.cpp:3114-3117`) — unlike the font override, a size override of `0`
 * (or absent) does NOT win; it falls through to the ancestor walk exactly
 * like an unauthored one. `builtInDefaultPx` stands in for
 * `ThemeDB::get_fallback_font_size()`, Godot's OWN final rung — this
 * previewer's `DEFAULT_FONT_SIZE` (`r3f/controls/godotDefaultTheme.ts`),
 * scaled — which this function ALWAYS falls back to, so it never returns
 * anything but a concrete, positive size.
 */
export function resolveThemeFontSizeIn(
  scope: ThemeResolutionScope,
  name: string,
  override: number | undefined,
  builtInDefaultPx: number
): number {
  if (override !== undefined && override > 0) return override;

  for (const theme of scope.searchOrder) {
    for (const type of scope.typeChain) {
      const found = fontSizeInTheme(theme, type, name);
      if (found !== undefined) return found;
    }
  }
  return builtInDefaultPx;
}

