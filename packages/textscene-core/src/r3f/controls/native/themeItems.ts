/**
 * Theme item resolution for a Control: its StyleBoxes, colours, constants and icons through the
 * override-then-theme-chain walk. It holds no React, so a pure solver imports it.
 */
import type { TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Rgba } from '../../../godot/math/math.js';
import { perObject } from '../../../utils/perObject';
import { NO_DEFAULT_FONTS } from '../../../resources/fonts/font/defaultFont';
import { isThemeLocalToScene } from '../../../resources/styles/theme/isThemeLocalToScene';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import {
  mergeThemedRecord,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../resources/styles/theme/lookup';
import type { SceneScope } from '../../liveSceneTree';
import type { SolveNode, ThemedIconRef } from './solveTree';
import { parseStyleBox, type ResolvedStyleBox } from './parseStyleBox';

/** A node's own override is held by the node, not by a theme (`NODE_PROPERTY` in `useTexture2D.ts`, which a pure module cannot import). */
const IS_HELD_BY_NODE = true;

/** No ancestor or project theme: `mergeThemedRecord` returns the seed unchanged. */
const NO_THEME_SCOPE: ThemeResolutionScope = {
  typeChain: [],
  searchOrder: [],
  variation: undefined,
  projectDefaultFont: null,
  defaultFonts: NO_DEFAULT_FONTS,
};

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
 * theme chain. An unresolvable ref is omitted, and all four StyleBox kinds are
 * kept: each wraps a `StyleBoxFlatData` core with its own `contentMargin`.
 */
export function resolveStyleBoxes(
  node: TscnNode,
  scope: SceneScope,
  themeScope: ThemeResolutionScope = NO_THEME_SCOPE
): Readonly<Record<string, ResolvedStyleBox>> {
  const overrides = (node.properties as ControlProperties).themeOverrideStyles;
  const local: Record<string, ResolvedStyleBox> = {};
  if (overrides) {
    for (const [key, ref] of Object.entries(overrides)) {
      const resolved = parseStyleBox(ref, scope.externalResources, scope.internalResources, IS_HELD_BY_NODE);
      if (resolved) local[key] = resolved;
    }
  }
  return mergeThemedRecord(themeScope, local, resolvedStylesOfTheme);
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
  return mergeThemedRecord(themeScope, local, (theme) => theme.colors);
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
  return mergeThemedRecord(themeScope, local, (theme) => theme.constants);
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
  return mergeThemedRecord(themeScope, local, iconRefsOfTheme);
}

export type InternalThemeItems = Pick<SolveNode, 'styleBoxes' | 'colors' | 'constants' | 'icons'>;

/** Written only by `internalChildThemeItems`: a parent node is replaced when the scene changes, so its internal Controls resolve once per type and variation. */
const internalThemeItemsOf = perObject((_parent: SolveNode) => new Map<string, InternalThemeItems>());

/**
 * The theme items of a Control `memnew`d inside `parent` and never serialised, such as a dialog's
 * buttons. It resolves them through the parent's theme chain by its own class chain
 * (`Control::get_theme_stylebox`, `control.cpp:3078`, then `ThemeOwner::get_theme_item_in_types`), and no
 * scene line overrides them. A `variation` is the `theme_type_variation` its constructor sets.
 */
export function internalChildThemeItems(
  parent: SolveNode,
  type: string,
  variation?: string
): InternalThemeItems {
  const byType = internalThemeItemsOf(parent);
  const key = variation === undefined ? type : `${type}/${variation}`;
  const known = byType.get(key);
  if (known) return known;
  const themeScope = themeResolutionScope(type, variation, parent.themeChain, parent.projectFonts);
  const node = { name: type, type, children: [], properties: {}, rawProperties: {} } as TscnNode;
  const items = {
    styleBoxes: resolveStyleBoxes(node, parent.resources, themeScope),
    colors: resolveThemedColors(node, themeScope),
    constants: resolveThemedConstants(node, themeScope),
    icons: resolveThemedIcons(node, parent.resources, themeScope),
  };
  byType.set(key, items);
  return items;
}
