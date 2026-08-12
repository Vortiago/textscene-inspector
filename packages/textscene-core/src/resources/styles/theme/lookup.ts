/**
 * The theme-item lookup — Godot's ancestor + type-dependency walk for a Font,
 * over the `ThemeResource`s `decode.ts` produced. Pure: no I/O, no parsing.
 */

import { NODE_BASE_TYPES } from '../../../linter/nodeBaseTypes';
import type { FontResource } from '../../fonts/font/types';
import type { ThemeResource } from './types';

/**
 * This node's real Godot class name, then its `NODE_BASE_TYPES` ancestry — the
 * native-inheritance half of the type-dependency chain.
 *
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
