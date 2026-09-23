/**
 * The theme-item lookup: Godot's ancestor and type-dependency walk over the
 * `ThemeResource`s `decode.ts` produces. Pure: no I/O, no parsing.
 */

import { NODE_BASE_TYPES } from '../../../linter/nodeBaseTypes';
import type { FontResource } from '../../fonts/font/types';
import type { ThemeResource } from './types';

/**
 * Memoises `nativeTypeChain`, which runs for every Control on every theme lookup.
 * The cached arrays are shared: a caller must not mutate one.
 */
const nativeTypeChainCache = new Map<string, readonly string[]>();

/** The class name, then its `NODE_BASE_TYPES` ancestry: the native half of the type chain. */
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
 * type names one item lookup tries, in order. The native inheritance chain is
 * always appended, whatever the variation walk finds. `NODE_BASE_TYPES`
 * stands in for `ThemeDB::get_native_type_dependencies`: theme items live at `Control` or below.
 */
export function buildThemeTypeChain(
  nativeType: string,
  typeVariation: string | undefined,
  ancestorThemes: readonly ThemeResource[],
  projectTheme: ThemeResource | null
): string[] {
  const chain: string[] = [];

  if (typeVariation) {
    // The first theme, nearest ancestor first and project last, to register the
    // variation owns its `base_type` walk (`scene/theme/theme_owner.cpp:181-224`),
    // which stops before `nativeType`.
    const owner = themeSearchOrder(ancestorThemes, projectTheme).find((t) =>
      Object.hasOwn(t.typeVariations, typeVariation)
    );
    if (owner) {
      // Godot walks this unguarded. A previewer reads files it did not write, so
      // a `MyPanel/base_type = &"MyPanel"` cycle must stop the walk.
      const seen = new Set<string>();
      let current: string | undefined = typeVariation;
      while (current !== undefined && current !== '' && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        const base: string | undefined = Object.hasOwn(owner.typeVariations, current)
          ? owner.typeVariations[current]
          : undefined;
        current = base;
        if (current === nativeType) break;
      }
    }
  }

  return [...chain, ...nativeTypeChain(nativeType)];
}

/**
 * `Theme::has_theme_item`'s FONT branch (`scene/resources/theme.cpp:1009-1030`):
 * an explicit `<type>/fonts/<name>` wins, else `default_font`, except for a
 * variation type this theme registers (`has_font_no_default`). `undefined`
 * tells the caller to keep walking.
 */
function fontInTheme(theme: ThemeResource, type: string, name: string): FontResource | undefined {
  const explicit = theme.fonts[type]?.[name];
  if (explicit !== undefined) return explicit;
  if (Object.hasOwn(theme.typeVariations, type)) return undefined;
  return theme.defaultFont ?? undefined;
}

/** The font-size counterpart of `fontInTheme` (`Theme::has_theme_item`'s FONT_SIZE branch, same file/lines). */
function fontSizeInTheme(theme: ThemeResource, type: string, name: string): number | undefined {
  const explicit = theme.fontSizes[type]?.[name];
  if (explicit !== undefined) return explicit;
  if (Object.hasOwn(theme.typeVariations, type)) return undefined;
  return theme.defaultFontSize;
}

/**
 * The part of a theme lookup that depends on the node alone, never the item
 * name: the type chain and the theme search order. A node builds it once for
 * its font and font-size lookups in both the solve and the paint pass.
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
 * A Control's resolved theme font (`Control::get_theme_font`,
 * `scene/gui/control.cpp:3083-3103`; `ThemeOwner::get_theme_item_in_types`,
 * `scene/theme/theme_owner.cpp:227-254`). Null when nothing defines it: the
 * painter then draws its bundled default face.
 *
 * @param override The node's own `theme_override_fonts/<name>`, which wins once
 *   declared with no validity check (`control.cpp:3089-3093`). `undefined` means
 *   not authored, `null` means authored but unresolved: stop, no font.
 * @param scope `ancestorThemes`, nearest first from this node's own `theme`, with no
 *   entry for a Control without one (`ThemeOwner::_get_next_owner_node`), then `projectTheme`
 *   (`gui/theme/custom`). Themes outer, types inner (`theme_owner.cpp:236-245`),
 *   so any `default_font` shadows a `<baseType>/fonts/<name>` on a farther ancestor.
 */
export function resolveThemeFontIn(
  scope: ThemeResolutionScope,
  name: string,
  override: FontResource | null | undefined
): FontResource | null {
  if (override !== undefined) return override;

  // Resolved, not usable: a `SystemFont` has no bytes in a browser. The painter
  // checks bytes with `resolveFontFileBytes` (`r3f/controls/native/text/sceneFontResolution.ts`),
  // so the walk never skips to a farther ancestor that Godot would not reach.
  for (const theme of scope.searchOrder) {
    for (const type of scope.typeChain) {
      const found = fontInTheme(theme, type, name);
      if (found !== undefined) return found;
    }
  }
  return null;
}

/**
 * The font-size counterpart of `resolveThemeFontIn` (`Control::get_theme_font_size`,
 * `control.cpp:3107-3129`). Always returns a positive size.
 *
 * @param override Wins only when `> 0` (`if (font_size && (*font_size) > 0)`,
 *   `control.cpp:3114-3117`). A `0` falls through like an unauthored one.
 * @param builtInDefaultPx Stands in for `ThemeDB::get_fallback_font_size()`:
 *   `DEFAULT_FONT_SIZE` (`r3f/controls/godotDefaultTheme.ts`), scaled.
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

/**
 * The StyleBox, Color and Constant sibling of `resolveThemeFontIn`, for every
 * name at once (`ThemeOwner::get_theme_item_in_types`, `theme_owner.cpp:227-261`:
 * owners outer, types inner, first hit wins). Filling only unset names in the
 * same order gives each name the same first hit as a single lookup.
 *
 * @param localOverrides `theme_override_*` entries, which always win with no
 *   validity check (`Control::get_theme_stylebox`, `get_theme_color`, `get_theme_constant`).
 * @param itemsOf A theme's per-type map. StyleBoxes come from a per-theme resolved
 *   cache, since each resolves against its own theme's `resources`, not the node.
 */
export function mergeThemedRecord<V>(
  scope: ThemeResolutionScope,
  localOverrides: Readonly<Record<string, V>>,
  itemsOf: (theme: ThemeResource) => Readonly<Record<string, Readonly<Record<string, V>>>> | undefined
): Readonly<Record<string, V>> {
  const out: Record<string, V> = { ...localOverrides };
  for (const theme of scope.searchOrder) {
    const byType = itemsOf(theme);
    if (!byType) continue;
    for (const type of scope.typeChain) {
      const atType = byType[type];
      if (!atType) continue;
      for (const [name, value] of Object.entries(atType)) {
        if (!Object.hasOwn(out, name)) out[name] = value;
      }
    }
  }
  return out;
}
