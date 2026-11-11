/**
 * The theme-item lookup: Godot's ancestor and type-dependency walk over the
 * `ThemeResource`s `decode.ts` produces. Pure: no I/O, no parsing.
 */

import { DEFAULT_FONT_SIZE, defaultThemeVariation } from '../../../godot/scene/theme';
import { classInheritanceChain } from '../../../godot/classdb/classBaseTypes';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { withDefaultFonts, type DefaultFonts } from '../../fonts/font/defaultFont';
import type { ProjectFonts } from '../../fonts/font/projectFonts';
import { resolveFontReference } from '../../fonts/font/resolveFontReference';
import type { FontResource } from '../../fonts/font/types';
import type { LoadedFont } from '../../scopedResource';
import { perObject } from '../../../utils/perObject';
import type { ThemeResource } from './types';

/**
 * Memoises `nativeTypeChain`, which runs for every Control on every theme lookup.
 * The cached arrays are shared: a caller must not mutate one.
 */
const nativeTypeChainCache = new Map<string, readonly string[]>();

/** `ThemeDB::get_native_type_dependencies` (`scene/theme/theme_db.cpp:198-208`). */
function nativeTypeChain(nativeType: string): readonly string[] {
  const cached = nativeTypeChainCache.get(nativeType);
  if (cached) return cached;

  const chain = classInheritanceChain(nativeType);
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
 * always appended, whatever the variation walk finds.
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
      registersVariation(t, typeVariation)
    );
    // No scene or project theme registers it: the default theme may (`theme_owner.cpp:200-208`).
    const baseOf = (variation: string): string | undefined =>
      owner ? ownerBaseOf(owner, variation) : defaultThemeVariation(variation)?.base;
    if (owner || defaultThemeVariation(typeVariation)) {
      // Godot walks this unguarded. A previewer reads files it did not write, so
      // a `MyPanel/base_type = &"MyPanel"` cycle must stop the walk.
      const seen = new Set<string>();
      let current: string | undefined = typeVariation;
      while (current !== undefined && current !== '' && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        current = baseOf(current);
        if (current === nativeType) break;
      }
    }
  }

  return [...chain, ...nativeTypeChain(nativeType)];
}

/** Whether `theme` registers `variation` (`Theme::set_type_variation`). Own keys only, so a name such as `constructor` reads no prototype. */
function registersVariation(theme: ThemeResource, variation: string): boolean {
  return Object.hasOwn(theme.typeVariations, variation);
}

/** The base a Theme registers for a variation, if it registers it. */
function ownerBaseOf(owner: ThemeResource, variation: string): string | undefined {
  return registersVariation(owner, variation) ? owner.typeVariations[variation] : undefined;
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
  if (registersVariation(theme, type)) return undefined;
  return theme.defaultFont ?? undefined;
}

/** The font-size counterpart of `fontInTheme` (`Theme::has_theme_item`'s FONT_SIZE branch, same file/lines). */
function fontSizeInTheme(theme: ThemeResource, type: string, name: string): number | undefined {
  const explicit = theme.fontSizes[type]?.[name];
  if (explicit !== undefined) return explicit;
  if (registersVariation(theme, type)) return undefined;
  return theme.defaultFontSize;
}

/**
 * The part of a theme lookup that depends on the node alone, never the item
 * name: the type chain and the theme search order. A node builds it once for
 * its font and font-size lookups in both the solve and the paint pass.
 */
export interface ThemeResolutionScope {
  readonly typeChain: readonly string[];
  /** The `theme_type_variation` the lookup was asked for, which the default theme may define though no Theme in `searchOrder` does. */
  readonly variation: string | undefined;
  readonly searchOrder: readonly ThemeResource[];
  /** The font a lookup reaches after every theme: the default theme's `default_font`. Null draws the bundled font. */
  readonly projectDefaultFont: FontResource | null;
  /** The fonts under a font with no face of its own (`defaultFontsOf`). */
  readonly defaultFonts: DefaultFonts;
}

/**
 * The fonts a `FontVariation` with no `base_font` or a `SystemFont` tries for its default
 * (`_get_base_font_or_default`, `scene/resources/font.cpp:2987-3039` and `3368-3415`): the project
 * theme's `font` for each type of `fontClass`, then the default theme's `default_font`, which is
 * `projectDefaultFont`, as is the fallback theme's font (`theme_db.cpp:73-80`). A scene ancestor's
 * theme is not in that context.
 */
function defaultFontCandidates(
  fontClass: 'FontVariation' | 'SystemFont',
  { projectTheme, projectDefaultFont }: ProjectFonts
): (FontResource | null)[] {
  const themed = projectTheme
    ? nativeTypeChain(fontClass).map((type) => fontInTheme(projectTheme, type, 'font'))
    : [];
  // A theme with a `default_font` answers it for every type: one entry is enough.
  return [...new Set([...themed.filter((found) => found !== undefined), projectDefaultFont])];
}

/** Stands in for a null project theme or project font as a cache key. */
const NO_KEY = {};

/**
 * Keyed by the project theme, then by the project font, not by the `ProjectFonts` object: a solve
 * tree resolves a new one on every build, and `withDefaultFonts` keys its cache on `DefaultFonts`.
 */
const defaultFontsByTheme = perObject((_projectTheme: object) => new WeakMap<object, DefaultFonts>());

/** One `DefaultFonts` per project theme and project font, which every node's scope shares. */
function defaultFontsOf(projectFonts: ProjectFonts): DefaultFonts {
  const byFont = defaultFontsByTheme(projectFonts.projectTheme ?? NO_KEY);
  const fontKey = projectFonts.projectDefaultFont ?? NO_KEY;
  const cached = byFont.get(fontKey);
  if (cached) return cached;
  const defaults: DefaultFonts = {
    variation: defaultFontCandidates('FontVariation', projectFonts),
    system: defaultFontCandidates('SystemFont', projectFonts),
  };
  byFont.set(fontKey, defaults);
  return defaults;
}

export function themeResolutionScope(
  nativeType: string,
  typeVariation: string | undefined,
  ancestorThemes: readonly ThemeResource[],
  projectFonts: ProjectFonts
): ThemeResolutionScope {
  const { projectTheme, projectDefaultFont } = projectFonts;
  const defaultFonts = defaultFontsOf(projectFonts);
  return {
    typeChain: buildThemeTypeChain(nativeType, typeVariation, ancestorThemes, projectTheme),
    variation: typeVariation,
    searchOrder: themeSearchOrder(ancestorThemes, projectTheme),
    projectDefaultFont: withDefaultFonts(projectDefaultFont, defaultFonts),
    defaultFonts,
  };
}

/**
 * The font a theme or an override defines for `name`, or `undefined` where none does. A caller
 * with its own last rung uses this: RichTextLabel's `bold_font` ends at a bold built over the
 * default font, not at the default font itself (`default_theme.cpp:1195`).
 *
 * @param override The node's own `theme_override_fonts/<name>`, which wins once
 *   declared with no validity check (`control.cpp:3089-3093`). `undefined` means
 *   not authored, `null` means authored but unresolved: stop, no font.
 * @param scope `ancestorThemes`, nearest first from this node's own `theme`, with no
 *   entry for a Control without one (`ThemeOwner::_get_next_owner_node`), then `projectTheme`
 *   (`gui/theme/custom`). Themes outer, types inner (`theme_owner.cpp:236-245`),
 *   so any `default_font` shadows a `<baseType>/fonts/<name>` on a farther ancestor.
 */
export function findThemeFontIn(
  scope: ThemeResolutionScope,
  name: string,
  override: FontResource | null | undefined
): FontResource | null | undefined {
  if (override !== undefined) return withDefaultFonts(override, scope.defaultFonts);

  for (const theme of scope.searchOrder) {
    for (const type of scope.typeChain) {
      const found = fontInTheme(theme, type, name);
      if (found !== undefined) return withDefaultFonts(found, scope.defaultFonts);
    }
  }
  return undefined;
}

/**
 * A Control's resolved theme font (`Control::get_theme_font`,
 * `scene/gui/control.cpp:3083-3103`; `ThemeOwner::get_theme_item_in_types`,
 * `scene/theme/theme_owner.cpp:227-254`). Null when nothing defines it, not even the
 * project's default font: the painter then draws its bundled default face. The arguments are
 * those of `findThemeFontIn`.
 */
export function resolveThemeFontIn(
  scope: ThemeResolutionScope,
  name: string,
  override: FontResource | null | undefined
): FontResource | null {
  const found = findThemeFontIn(scope, name, override);
  // The default theme's `default_font`, which the project font replaces
  // (`default_theme.cpp:1371-1373`), is the last rung (`theme_owner.cpp:227-254`).
  return found === undefined ? scope.projectDefaultFont : found;
}

/** What `fontForNode` reads a font from: the scene's resources, the font files loaded so far, the project's. */
interface FontContext {
  resources: SceneResources;
  loadedFont: LoadedFont;
  projectFonts: ProjectFonts;
}

/**
 * The font of a node outside the Control tree that has a `font` property: TextMesh
 * (`primitive_meshes.cpp:3779-3809`) and Label3D (`label_3d.cpp:812-850`). Its own font, which `ref`
 * names, wins, else the project theme's `font` for the node's type chain, else the default theme's
 * `default_font`. A `ref` that is unset, or whose file has not loaded or failed, names no own font.
 * Null is the bundled font. A scene ancestor's theme is not in the chain.
 *
 * @canonical The font of a TextMesh or Label3D: own font, project theme, project default font
 */
export function fontForNode(
  nativeType: string,
  ref: string | undefined,
  { resources, loadedFont, projectFonts }: FontContext
): FontResource | null {
  const own = resolveFontReference(ref, resources, loadedFont).font;
  const scope = themeResolutionScope(nativeType, undefined, [], projectFonts);
  return resolveThemeFontIn(scope, 'font', own ?? undefined);
}

/**
 * The font-size counterpart of `resolveThemeFontIn` (`Control::get_theme_font_size`,
 * `control.cpp:3107-3129`). Always returns a positive size.
 *
 * @param override Wins only when `> 0` (`if (font_size && (*font_size) > 0)`,
 *   `control.cpp:3114-3117`). A `0` falls through like an unauthored one.
 * @param builtInDefaultPx Stands in for `ThemeDB::get_fallback_font_size()`:
 *   `DEFAULT_FONT_SIZE` (`godot/scene/theme.ts`), scaled.
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
  return defaultThemeVariationFontSize(scope.variation, name) ?? builtInDefaultPx;
}

/** The default theme's font size for a variation, which sits after every Theme a scene or a project sets. */
function defaultThemeVariationFontSize(variation: string | undefined, name: string): number | undefined {
  if (variation === undefined || name !== 'font_size') return undefined;
  const step = defaultThemeVariation(variation)?.fontSizeStep;
  return step === undefined ? undefined : DEFAULT_FONT_SIZE + step;
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
