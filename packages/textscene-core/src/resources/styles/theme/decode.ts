/**
 * Theme decode — one Theme resource body's property bag in, its font-relevant
 * data out.
 *
 * Two decode paths, one shared scan (`scanTheme`): a FILE-BACKED `.tres`
 * decodes to `ThemeAddresses` (font refs left as loader addresses,
 * `loadTheme.ts`'s `resolveThemeResource` awaits them), a scene's own inline
 * `[sub_resource type="Theme"]` decodes straight to a `ThemeResource`
 * (`resolveInlineThemeResource`, synchronous — the solve walk that calls it
 * cannot `await` mid-walk).
 *
 * Font references are resolved recursively through the Font slice's own decode
 * (`fonts/font/decode.ts`), never re-implemented here: one decoder per type.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { unquoteStringName } from '../../../parser/utils';
import { parseOptionalFloat } from '../../../parser/valueParsers';
import { FONT_SUB_RESOURCE_TYPES, resolveInlineFontResource } from '../../fonts/font/decode';
import type { FontCacheReader } from '../../fonts/font/types';
import { resolveRefToResourcePath, subResourceTypeGate } from '../../subResourcePath';
import type { ScannedTheme, ThemeAddresses, ThemeResource } from './types';
import { indexedKeyRegex } from '../../../godot/index.js';

// A theme key is `/`-separated and Godot reads it with `split("/", true, 2)`
// (`theme.cpp`), so its segments go through the shared segment grammar rather
// than a spelling of their own — `indexedKeyGrammar.guard.test.ts` holds the
// whole package to that. `to_int` names the SEGMENT class; a theme's segments
// are names rather than indices, and nothing here reads one as a number.
/** `<Type>/fonts/<name>`. */
const FONT_ENTRY = indexedKeyRegex(String.raw`^(#)/fonts/(#)$`, 'to_int');
/** `<Type>/font_sizes/<name>`. */
const FONT_SIZE_ENTRY = indexedKeyRegex(String.raw`^(#)/font_sizes/(#)$`, 'to_int');
/** `<variationType>/base_type`. */
const BASE_TYPE_ENTRY = indexedKeyRegex(String.raw`^(#)/base_type$`, 'to_int');

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
  // Prototype-free: the theme-item TYPE and NAME halves are parsed straight out
  // of a `.tres` key, so `__proto__/fonts/toString = …` would otherwise resolve
  // truthy through the chain, skip the `??=` and land the write on
  // `Object.prototype`. `in` on the read side (`lookup.ts`) walks the chain too.
  const fonts: Record<string, Record<string, T>> = Object.create(null);
  const fontSizes: Record<string, Record<string, number>> = Object.create(null);
  const typeVariations: Record<string, string> = Object.create(null);
  const rest: Record<string, string> = Object.create(null);

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
      if (resolved !== null) (fonts[type!] ??= Object.create(null))[name!] = resolved;
      continue;
    }

    const sizeMatch = key.match(FONT_SIZE_ENTRY);
    if (sizeMatch) {
      const [, type, name] = sizeMatch;
      const n = parseOptionalFloat(value);
      if (n !== undefined && n > 0) (fontSizes[type!] ??= Object.create(null))[name!] = n;
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
 * Decode one file-backed Theme resource body into `ThemeAddresses`. Pure and
 * synchronous — no I/O. `selfPath` is the address a `SubResource`-valued font
 * ref resolves against (`resolveRefToResourcePath`'s `res://file.tres::SubId`
 * form) — always the OWNING `.tres`, never the Theme's own address.
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

/**
 * Resolve a scene's own inline `[sub_resource type="Theme"]` straight to a
 * `ThemeResource`, in one synchronous pass — the solve walk cannot `await`
 * mid-walk, and (unlike a file-backed `.tres`) there is no address-then-load
 * split to make: a `SubResource`-valued font ref inside an inline Theme
 * addresses a SIBLING sub-resource of the SAME scene, which
 * `resolveInlineFontResource` reads directly rather than routing through the
 * font processor — a `res://scene.tscn::SubId` address could never resolve
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
