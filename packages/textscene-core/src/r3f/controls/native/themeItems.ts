/**
 * Theme item resolution for a Control: its StyleBoxes, colours, constants and icons through the
 * override-then-theme-chain walk. It holds no React, so a pure solver imports it.
 */
import type { TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Rgba } from '../../../godot/math/math.js';
import { perObject } from '../../../utils/perObject';
import { isThemeLocalToScene } from '../../../resources/styles/theme/isThemeLocalToScene';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import {
  mergeThemedRecord,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../resources/styles/theme/lookup';
import type { SceneScope } from '../../liveSceneTree';
import type { ShareNode, SolveNode, ThemedIconRef } from './solveTree';
import { parseStyleBox, type ResolvedStyleBox } from './parseStyleBox';
import { defaultColorsOf, defaultConstantsOf, defaultStyleBoxesOf } from './defaultThemeRecords';

/** A node's own override is held locally: the node holds it, not a theme. */
const IS_HELD_BY_NODE = true;

/** Default icons are not in the table: `themeIcons.ts` draws them. */
const NO_DEFAULT_ICONS: Readonly<Record<string, Readonly<Record<string, ThemedIconRef>>>> = {};

/**
 * A theme's `styles` refs, resolved against that theme's own sub-resource pool,
 * never the querying node's: a Theme's StyleBoxes live in the theme file. Keyed by
 * the `ThemeResource` object, which every referencing node shares.
 */
const resolvedStylesOfTheme = perObject(
  (theme: ThemeResource): Readonly<Record<string, Readonly<Record<string, ResolvedStyleBox>>>> => {
    const { externalResources, internalResources } = theme.resources ?? {
      externalResources: [],
      internalResources: [],
    };
    const out: Record<string, Record<string, ResolvedStyleBox>> = {};
    for (const [type, byName] of Object.entries(theme.styles ?? {})) {
      for (const [name, ref] of Object.entries(byName)) {
        const resolved = parseStyleBox(ref, externalResources, internalResources, isThemeLocalToScene(theme));
        if (resolved) (out[type] ??= {})[name] = resolved;
      }
    }
    return out;
  }
);

/**
 * Every StyleBox slot, keyed as `Control::get_theme_stylebox` keys them. A
 * `theme_override_styles/*`, resolved in the node's own `scope`, wins over the
 * theme chain, and the default theme answers last. An unresolvable ref is omitted, and all four StyleBox kinds are
 * kept: each wraps a `StyleBoxFlatData` core with its own `contentMargin`.
 */
export function resolveStyleBoxes(
  node: TscnNode,
  scope: SceneScope,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, ResolvedStyleBox>> {
  const overrides = (node.properties as ControlProperties).themeOverrideStyles;
  const local: Record<string, ResolvedStyleBox> = {};
  if (overrides) {
    for (const [key, ref] of Object.entries(overrides)) {
      const resolved = parseStyleBox(ref, scope.externalResources, scope.internalResources, IS_HELD_BY_NODE);
      if (resolved) local[key] = resolved;
    }
  }
  return mergeThemedRecord(themeScope, local, resolvedStylesOfTheme, defaultStyleBoxesOf);
}

/**
 * Every theme colour, keyed as `Control::get_theme_color` keys them: a
 * `theme_override_colors/*` wins with no validity gate, else the theme chain.
 */
export function resolveThemedColors(
  node: TscnNode,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, Rgba>> {
  const local = (node.properties as ControlProperties).themeOverrideColors ?? {};
  return mergeThemedRecord(themeScope, local, (theme) => theme.colors, defaultColorsOf);
}

/**
 * The constant counterpart of `resolveThemedColors` (`Control::get_theme_constant`).
 * A Theme's `<Type>/constants/<name>` is an unscaled int. Only a painter's own
 * built-in fallback on a miss is scaled.
 */
export function resolveThemedConstants(
  node: TscnNode,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, number>> {
  const local = (node.properties as ControlProperties).themeOverrideConstants ?? {};
  return mergeThemedRecord(themeScope, local, (theme) => theme.constants, defaultConstantsOf);
}

/**
 * A theme's `icons` refs, each paired with that theme's scope and cached per
 * theme like `resolvedStylesOfTheme`. Left unresolved: loading a texture needs a
 * `useTexture2D` subscription only a component can hold.
 */
const iconRefsOfTheme = perObject(
  (theme: ThemeResource): Readonly<Record<string, Readonly<Record<string, ThemedIconRef>>>> => {
    const resources = theme.resources ?? { externalResources: [], internalResources: [] };
    const out: Record<string, Record<string, ThemedIconRef>> = {};
    for (const [type, byName] of Object.entries(theme.icons ?? {})) {
      for (const [name, ref] of Object.entries(byName)) {
        (out[type] ??= {})[name] = { ref, resources, isHeldLocally: isThemeLocalToScene(theme) };
      }
    }
    return out;
  }
);

/**
 * `Control::get_theme_icon`'s override-then-chain walk. A local
 * `theme_override_icons/<name>` ref carries the node's own `scope`, and a Theme's
 * `<Type>/icons/<name>` carries that theme's scope.
 */
export function resolveThemedIcons(
  node: TscnNode,
  scope: SceneScope,
  themeScope: ThemeResolutionScope
): Readonly<Record<string, ThemedIconRef>> {
  const overrides = (node.properties as ControlProperties).themeOverrideIcons;
  const local: Record<string, ThemedIconRef> = {};
  if (overrides) {
    for (const [key, ref] of Object.entries(overrides)) {
      local[key] = { ref, resources: scope, isHeldLocally: IS_HELD_BY_NODE };
    }
  }
  return mergeThemedRecord(themeScope, local, iconRefsOfTheme, () => NO_DEFAULT_ICONS);
}

/**
 * `items[name]` for an item the default theme sets for the type: the table answers every such name, so a
 * miss is a missing table entry, never a gap a theme left.
 */
export function requiredThemeItem<V>(items: Readonly<Record<string, V>>, name: string): V {
  const found = items[name];
  if (found === undefined) {
    throw new Error(`expected the default theme to hold the theme item "${name}", found none`);
  }
  return found;
}

export type InternalThemeItems = Pick<SolveNode, 'styleBoxes' | 'colors' | 'constants' | 'icons'>;

/** Written only by `themeItemsOfType`: a parent node is replaced when the scene changes, so its internal Controls resolve once per type and variation. */
const internalThemeItemsOf = perObject((_parent: ShareNode) => new Map<string, InternalThemeItems>());

/**
 * The theme items of a Control of `type` built inside `owner` and never serialised, such as a
 * dialog's buttons, and what `owner` reads when it names another theme type (`BIND_THEME_ITEM_EXT`,
 * `scene/theme/theme_db.h`). The lookup walks `owner`'s theme chain by `type`'s class chain, and
 * `variation` is the `theme_type_variation` a constructor sets.
 */
export function themeItemsOfType(owner: ShareNode, type: string, variation?: string): InternalThemeItems {
  const byType = internalThemeItemsOf(owner);
  const key = variation === undefined ? type : `${type}/${variation}`;
  const known = byType.get(key);
  if (known) return known;
  const themeScope = themeResolutionScope(type, variation, owner.themeChain, owner.projectFonts);
  const node = builtControlNode(type);
  const items = {
    styleBoxes: resolveStyleBoxes(node, owner.resources, themeScope),
    colors: resolveThemedColors(node, themeScope),
    constants: resolveThemedConstants(node, themeScope),
    icons: builtControlIcons(owner, type, variation),
  };
  byType.set(key, items);
  return items;
}

/** What a Control `memnew`d inside `parent` resolves its icons to: the `icons` of `themeItemsOfType`, without the other items. */
export function builtControlIcons(
  parent: Pick<SolveNode, 'resources' | 'themeChain' | 'projectFonts'>,
  type: string,
  variation?: string
): Readonly<Record<string, ThemedIconRef>> {
  const themeScope = themeResolutionScope(type, variation, parent.themeChain, parent.projectFonts);
  return resolveThemedIcons(builtControlNode(type), parent.resources, themeScope);
}

/** A node with no scene line, so no override. */
function builtControlNode(type: string): TscnNode {
  return { name: type, type, children: [], properties: {}, rawProperties: {} } as TscnNode;
}
