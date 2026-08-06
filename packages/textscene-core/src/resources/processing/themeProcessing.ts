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
 */

import type { ParsedTresFile } from '../../parser/tresParser';
import { parseTresFile } from '../../parser/tresParser';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { unquoteString } from '../../parser/utils';
import { parseOptionalFloat } from '../../parser/valueParsers';
import { NODE_BASE_TYPES } from '../../linter/nodeBaseTypes';
import { findSubResource } from '../SubResourceResolver';
import { parseSubResourcePath, resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath';
import type { FontLoaderFn, FontResource } from './fontProcessing';

/** The Font sub-resource types a Theme's `default_font`/`<Type>/fonts/<name>` can point at — same set `fontProcessing.ts` resolves. */
const FONT_SUB_RESOURCE_TYPES: ReadonlySet<string> = new Set(['FontFile', 'SystemFont', 'FontVariation']);

/** `<Type>/fonts/<name>`. */
const FONT_ENTRY = /^([^/]+)\/fonts\/([^/]+)$/;
/** `<Type>/font_sizes/<name>`. */
const FONT_SIZE_ENTRY = /^([^/]+)\/font_sizes\/([^/]+)$/;
/** `<variationType>/base_type`. */
const BASE_TYPE_ENTRY = /^([^/]+)\/base_type$/;

/**
 * Godot's text saver prefixes a StringName-typed property with `&`
 * (`base_type` and `theme_type_variation` are both StringName) —
 * `title_panel/base_type = &"Panel"`. Strip the sigil before unquoting; a
 * bare quoted string passes through unchanged for leniency.
 */
function unquoteStringName(value: string): string {
  const unsigiled = value.startsWith('&') ? value.slice(1) : value;
  return unquoteString(unsigiled);
}

/**
 * A Theme's font-relevant data, decoded to typed values but with every Font
 * reference left as a **Sub-resource path** ADDRESS rather than a resolved
 * `FontResource` — the seam between the format-decode (this) and the two
 * different ways an address becomes a resource: `resolveThemeResource`
 * (async, awaits the loader) for a file-backed Theme, and
 * `resolveThemeResourceFromCache` (sync, cache-read + pending) for a
 * scene-inline Theme SubResource, which `buildSolveTree.ts` cannot `await`
 * mid-walk.
 */
export interface ThemeAddresses {
  /** `default_font`, resolved to an address; null when absent or malformed. */
  defaultFont: string | null;
  /** `default_font_size`, gated `> 0` (`Theme::has_default_font_size`, `theme.cpp:274-276`). */
  defaultFontSize: number | undefined;
  /** `<Type>/fonts/<name>` → address. Entries with an absent/malformed ref are omitted. */
  fonts: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `<Type>/font_sizes/<name>` → number, each already gated `> 0`. */
  fontSizes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** `<variationType>/base_type` → the type (or another variation) it derives from. */
  typeVariations: Readonly<Record<string, string>>;
  /** Every other declared property (styles, colors, constants, icons, …), raw. */
  properties: Readonly<Record<string, string>>;
}

/**
 * Decode one Theme resource body (a `.tres`'s own `[resource]`, or one of its
 * `[sub_resource]`s, or a scene's own inline `[sub_resource type="Theme"]`)
 * into `ThemeAddresses`. Pure and synchronous — no I/O, so it is the shared
 * core both the file-backed and scene-inline resolution paths call. `selfPath`
 * is the address a `SubResource`-valued font ref resolves against
 * (`resolveRefToResourcePath`'s `res://file.tres::SubId`/`res://scene.tscn::SubId`
 * form) — always the OWNING document, never the Theme's own address.
 */
export function decodeThemeAddresses(
  selfPath: string,
  properties: Record<string, string>,
  extResources: readonly TscnExternalResource[],
  subResources: readonly TscnInternalResource[]
): ThemeAddresses {
  const extPathById = new Map(extResources.map((r) => [r.id, r.path]));
  const gate = subResourceTypeGate(subResources, FONT_SUB_RESOURCE_TYPES);
  const toAddress = (ref: string | undefined): string | null =>
    resolveRefToResourcePath(ref, extPathById, selfPath, gate);

  const fonts: Record<string, Record<string, string>> = {};
  const fontSizes: Record<string, Record<string, number>> = {};
  const typeVariations: Record<string, string> = {};
  const rest: Record<string, string> = {};

  let defaultFont: string | null = null;
  let defaultFontSize: number | undefined;

  for (const [key, value] of Object.entries(properties)) {
    if (key === 'default_font') {
      defaultFont = toAddress(value);
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
      const address = toAddress(value);
      if (address) (fonts[type!] ??= {})[name!] = address;
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
 * A Theme, decoded to the point a font lookup can use it: every Font
 * reference resolved to a `FontResource`, everything else still raw.
 *
 * `fonts`/`defaultFont` collapse "declared but invalid" (a `null` literal, a
 * ref that failed to load, a `SystemFont` this previewer cannot fetch bytes
 * for) to the same absence a NEVER-declared entry has — `Theme::has_font`
 * only tests `Ref<Font>::is_valid()`
 * (`scene/resources/theme.cpp:549-552`), so a Theme can never distinguish
 * "explicitly nothing" from "never set" at this level. This collapse is
 * specific to fonts/font-sizes: colors, constants and styles (kept raw here)
 * do NOT share it, so a future consumer decoding those must not assume it.
 */
export interface ThemeResource {
  /** `default_font`, resolved; null when absent, malformed, or invalid (`Theme::has_default_font`). */
  defaultFont: FontResource | null;
  /** `default_font_size`, already `> 0`-gated. */
  defaultFontSize: number | undefined;
  /** `<Type>/fonts/<name>` → resolved Font. Presence == usable (see class doc). */
  fonts: Readonly<Record<string, Readonly<Record<string, FontResource>>>>;
  /** `<Type>/font_sizes/<name>` → number, each already `> 0`-gated. */
  fontSizes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** `<variationType>/base_type` → the type (or another variation) it derives from. */
  typeVariations: Readonly<Record<string, string>>;
  /** Every other declared property, raw. */
  properties: Readonly<Record<string, string>>;
}

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
 * The synchronous counterpart to `resolveThemeResource`, for a Theme
 * `buildSolveTree.ts` cannot `await` mid-walk — a scene's own inline
 * `[sub_resource type="Theme"]`. Reads each font address off `fontCache`
 * instead of awaiting the loader; an address not yet cached is pushed onto
 * `pending` (mirrors `resolveTextureSize`'s cache-read + pending-collection
 * in that same module) and treated as unresolved for THIS pass — the caller
 * requests it and the next pass, triggered once the `font` processor's
 * `loaded`/`failed` event bumps `generation`, sees the real value.
 */
export function resolveThemeResourceFromCache(
  addresses: ThemeAddresses,
  fontCache: FontCacheReader,
  pending: Set<string>
): ThemeResource {
  const readFont = (address: string | null): FontResource | null => {
    if (!address) return null;
    const cached = fontCache.getCached(address);
    if (cached === undefined) {
      pending.add(address);
      return null;
    }
    return cached;
  };

  const defaultFont = readFont(addresses.defaultFont);

  const fonts: Record<string, Record<string, FontResource>> = {};
  for (const [type, byName] of Object.entries(addresses.fonts)) {
    const resolvedByName: Record<string, FontResource> = {};
    for (const [name, address] of Object.entries(byName)) {
      const font = readFont(address);
      if (font) resolvedByName[name] = font;
    }
    if (Object.keys(resolvedByName).length) fonts[type] = resolvedByName;
  }

  return {
    defaultFont,
    defaultFontSize: addresses.defaultFontSize,
    fonts,
    fontSizes: addresses.fontSizes,
    typeVariations: addresses.typeVariations,
    properties: addresses.properties,
  };
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
  const parsed: ParsedTresFile = parseTresFile(content);

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
function nativeTypeChain(nativeType: string): string[] {
  const chain: string[] = [nativeType];
  let base: string | undefined = NODE_BASE_TYPES[nativeType];
  while (base !== undefined) {
    chain.push(base);
    base = NODE_BASE_TYPES[base];
  }
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
 *     `resolveThemeFontSizePx`); `null` is the signal a painter renders its
 *     own bundled default face for.
 */
export function resolveThemeFont(
  name: string,
  override: FontResource | null | undefined,
  nativeType: string,
  typeVariation: string | undefined,
  ancestorThemes: readonly ThemeResource[],
  projectTheme: ThemeResource | null
): FontResource | null {
  if (override !== undefined) return override;

  const typeChain = buildThemeTypeChain(nativeType, typeVariation, ancestorThemes, projectTheme);
  for (const theme of themeSearchOrder(ancestorThemes, projectTheme)) {
    for (const type of typeChain) {
      const found = fontInTheme(theme, type, name);
      if (found !== undefined) return found;
    }
  }
  return null;
}

/**
 * The font-size counterpart of `resolveThemeFont`
 * (`Control::get_theme_font_size`, `control.cpp:3113-3131`). Godot's local
 * override ALSO requires `> 0` (`if (font_size && (*font_size) > 0)`,
 * `control.cpp:3117-3120`) — unlike the font override, a size override of `0`
 * (or absent) does NOT win; it falls through to the ancestor walk exactly
 * like an unauthored one. `builtInDefaultPx` stands in for
 * `ThemeDB::get_fallback_font_size()`, Godot's OWN final rung — this
 * previewer's `DEFAULT_FONT_SIZE` (`r3f/controls/godotDefaultTheme.ts`),
 * scaled — which this function ALWAYS falls back to, so it never returns
 * anything but a concrete, positive size.
 */
export function resolveThemeFontSizePx(
  name: string,
  override: number | undefined,
  nativeType: string,
  typeVariation: string | undefined,
  ancestorThemes: readonly ThemeResource[],
  projectTheme: ThemeResource | null,
  builtInDefaultPx: number
): number {
  if (override !== undefined && override > 0) return override;

  const typeChain = buildThemeTypeChain(nativeType, typeVariation, ancestorThemes, projectTheme);
  for (const theme of themeSearchOrder(ancestorThemes, projectTheme)) {
    for (const type of typeChain) {
      const found = fontSizeInTheme(theme, type, name);
      if (found !== undefined) return found;
    }
  }
  return builtInDefaultPx;
}
