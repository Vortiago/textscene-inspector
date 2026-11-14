/**
 * The Controls a class builds in its constructor and never serialises, Godot's internal children
 * (`Node::add_child` with `INTERNAL_MODE_FRONT` or `INTERNAL_MODE_BACK`). A class declares them once
 * as a spec tree. The one rect solve places them (`controlRectSolver.ts`) and the one Control walker
 * paints them (`InternalControlGroup.tsx`), as they do any authored Control.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ZERO_RECT, type Rect2 } from '../../../godot/math/rect2';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import type { TscnNode } from '../../../parser/types';
import type { NativeControlComponent } from '../ControlComponentRegistry';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import { parseControlCanvasItem } from '../../../nodes/2d/ui/control/parser';
import type { ButtonProperties } from '../../../nodes/2d/ui/button/types';
import type { NativeTheme } from './nativeTheme';
import { sortableView, type SolveNode, type ThemedIconRef } from './solveTree';
import type { SealedHandoff } from './solveHandoff';
import {
  themedSlotRequest,
  type BuiltIconsFn,
  type SolveContext,
  type TextureSlotRequest,
} from './solverRegistry';
import { themeItemsOfType, type InternalThemeItems } from './themeItems';
import { perObject } from '../../../utils/perObject';

/**
 * `INTERNAL_MODE_FRONT` draws under the authored children, from a piece of the parent's own slot.
 * `INTERNAL_MODE_BACK` draws over them, from a piece of the parent's back slot.
 */
export type InternalMode = 'front' | 'back';

/** One Control a constructor `memnew`s, with the Controls it holds. */
export interface InternalControlSpec {
  type: string;
  name: string;
  /**
   * The properties the constructor sets, over those a Control named `name` parses to with no scene
   * line. Runtime state that no scene line carries goes here too, as `ButtonProperties.hasFocus` does.
   */
  properties: object;
  children?: readonly InternalControlSpec[];
  /** The `theme_type_variation` the constructor sets. */
  variation?: string;
  /** Icons the parent's theme gives it, by name. Any the parent's theme chain gives its type override them. */
  icons?: SolveNode['icons'];
  /** Set where the constructor sizes the Control's texture itself. Otherwise a built Button reads its theme icon's slot. */
  textureSize?: SolveNode['textureSize'];
  /** The textures the parent resolved for it, by slot key, such as the icons of a TabContainer's tabs. */
  textureSlots?: SolveNode['textureSlots'];
  /** The theme items the parent pushes with `add_theme_*_override`. Each wins over the Control's own lookup. */
  pushed?: PushedThemeItems;
  /**
   * What the parent draws on the Control through its `draw` signal (`CanvasItem::_redraw_callback`,
   * `canvas_item.cpp:148-149`): drawn after the class's own `NOTIFICATION_DRAW` painter, in the same item.
   */
  draws?: NativeControlComponent;
}

/** What a parent can push onto an internal Control, by theme item name. */
export interface PushedThemeItems extends Partial<
  Pick<SolveNode, 'styleBoxes' | 'colors' | 'constants' | 'fontOverrides'>
> {
  /** `undefined` pushes the default icon: it hides an icon the Control's own lookup finds. */
  icons?: Readonly<Record<string, ThemedIconRef | undefined>>;
  /** In pixels. They land where an authored `theme_override_font_sizes/*` lands. */
  fontSizes?: Readonly<Record<string, number>>;
  /** Icons of the default theme, as vendored URLs: `SolveNode.defaultIcons`. Each hides the Control's own lookup of its name. */
  defaultIcons?: Readonly<Record<string, string>>;
}

/** A top-level internal Control of a parent: the root of one spec tree and the place it draws. */
export interface InternalControlEntry {
  mode: InternalMode;
  spec: InternalControlSpec;
}

/** A built top-level internal Control. */
export interface InternalControl {
  mode: InternalMode;
  node: SolveNode;
}

export type InternalControlsFn = (parent: SolveNode, theme: NativeTheme) => readonly InternalControlEntry[];

/** An `InternalLayoutFn`'s result when it also hands an internal Control's painter a value. */
export interface InternalLayoutResult {
  rects: ReadonlyMap<string, Rect2>;
  /**
   * Solve output an internal Control's painter cannot reach, by path, sealed by a channel
   * (`solveHandoff.ts`). It surfaces on that Control's `SolvedControl.meta`.
   */
  meta: ReadonlyMap<string, SealedHandoff>;
}

/**
 * Places the top-level internal Controls of `parent` in its `rect`, by path, in the parent's own
 * space. The subtrees below them solve as any Control's do, and the solve floors each rect at its
 * minimum. A Control left out of the map gets a zero rect.
 */
export type InternalLayoutFn = (
  parent: SolveNode,
  internals: readonly InternalControl[],
  rect: Rect2,
  ctx: SolveContext
) => ReadonlyMap<string, Rect2> | InternalLayoutResult;

/** One placed top-level internal Control. */
interface InternalPlacement {
  node: SolveNode;
  rect: Rect2;
  meta: SealedHandoff | undefined;
}

const NO_META: ReadonlyMap<string, SealedHandoff> = new Map();

/** An `InternalLayoutFn`'s result, normalised. No `Map` has a `rects` own property, so the test is exact. */
function normalizedLayout(result: ReturnType<InternalLayoutFn>): InternalLayoutResult {
  return 'rects' in result ? result : { rects: result, meta: NO_META };
}

interface Registration {
  build: InternalControlsFn;
  layout: InternalLayoutFn;
}

/** Written only by `registerInternalControls`, at module load. Matches one type name exactly, as the solver registry does. */
const registrations = new Map<string, Registration>();

export function registerInternalControls(
  typeName: string,
  build: InternalControlsFn,
  layout: InternalLayoutFn
): void {
  registrations.set(typeName, { build, layout });
}

const NONE: readonly InternalControl[] = Object.freeze([]);
const NO_PLACEMENTS: readonly InternalPlacement[] = Object.freeze([]);

/**
 * Written only by `internalControlsOf`. By node, then by theme: a scene change replaces the parent
 * node, and a theme scale change keeps it.
 */
const builtByParent = perObject(
  (_parent: SolveNode) => new WeakMap<NativeTheme, readonly InternalControl[]>()
);

/** What `parent`'s class registers, or `undefined` when it registers no internal Controls. */
function registrationOf(parent: SolveNode) {
  return registrations.get(parent.node.type);
}

/**
 * The internal Controls of `parent`, built once for each (parent, theme). Empty for a class that
 * registers none. The node and its `sortableView`, which the solver hands a layout, share one build.
 */
export function internalControlsOf(parent: SolveNode, theme: NativeTheme): readonly InternalControl[] {
  const registration = registrationOf(parent);
  if (!registration) return NONE;
  const owner = sortableView(parent);
  const byTheme = builtByParent(owner);
  const known = byTheme.get(theme);
  if (known) return known;
  const built = registration.build(owner, theme).map(({ mode, spec }) => ({
    mode,
    node: internalControlNode(owner, spec),
  }));
  byTheme.set(theme, built);
  return built;
}

/** Each top-level internal Control of `parent` with the rect and the value its class's layout gives it. */
export function placeInternalControls(
  parent: SolveNode,
  rect: Rect2,
  ctx: SolveContext
): readonly InternalPlacement[] {
  const registration = registrationOf(parent);
  if (!registration) return NO_PLACEMENTS;
  const internals = internalControlsOf(parent, ctx.theme);
  const { rects, meta } = normalizedLayout(registration.layout(parent, internals, rect, ctx));
  return internals.map(({ node }) => ({
    node,
    rect: rects.get(node.path) ?? ZERO_RECT,
    meta: meta.get(node.path),
  }));
}

/** The path an internal Control gets: its parent's, then its own name. A container lays its children out by this link. */
function syntheticPath(parentPath: string, name: string): string {
  return `${parentPath}/@${name}`;
}

/**
 * The tree `spec` builds inside `owner`, the Control whose constructor builds it, as `SolveNode`s in
 * the owner's scope. It has no scene node, so none of the owner's own theme items apply to it. Its
 * own come through the owner's theme chain by its class chain.
 */
export function internalControlNode(owner: SolveNode, spec: InternalControlSpec): SolveNode {
  return buildUnder(owner, spec, owner.path);
}

function buildUnder(owner: SolveNode, spec: InternalControlSpec, parentPath: string): SolveNode {
  const { type, name, variation, pushed = {} } = spec;
  const path = syntheticPath(parentPath, name);
  const node: TscnNode = {
    name,
    type,
    children: [],
    properties: builtProperties(spec, pushed.fontSizes),
    rawProperties: {},
  };
  const items = themeItemsOfType(owner, type, variation);
  const textureSize =
    spec.textureSize !== undefined ? spec.textureSize : builtButtonTextureSize(owner, spec, items);
  return {
    ...owner,
    path,
    node,
    children: (spec.children ?? []).map((child) => buildUnder(owner, child, path)),
    styleBoxes: { ...items.styleBoxes, ...pushed.styleBoxes },
    colors: { ...items.colors, ...pushed.colors },
    constants: { ...items.constants, ...pushed.constants },
    icons: iconsUnder(spec, items),
    defaultIcons: pushed.defaultIcons,
    draws: spec.draws,
    fontOverrides: { ...pushed.fontOverrides },
    textureSize,
    textureSlots: spec.textureSlots ?? {},
    labelSettings: null,
    labelSettingsFont: null,
  };
}

/** The icons of the Control `spec` builds: the parent's theme, its own lookup, then what the parent pushes, default icons included. */
function iconsUnder(
  { icons: given, pushed }: InternalControlSpec,
  items: InternalThemeItems
): SolveNode['icons'] {
  const icons: Record<string, ThemedIconRef> = { ...given, ...items.icons };
  for (const name of Object.keys(pushed?.defaultIcons ?? {})) delete icons[name];
  for (const [name, ref] of Object.entries(pushed?.icons ?? {})) {
    if (ref) icons[name] = ref;
    else delete icons[name];
  }
  return icons;
}

/**
 * What a Control named `name` parses to with no scene line, then `spec.properties`, with the variation
 * as the `theme_type_variation` `set_theme_type_variation` writes and the pushed font sizes as overrides.
 */
function builtProperties(
  { name, properties, variation }: InternalControlSpec,
  pushedFontSizes: PushedThemeItems['fontSizes']
): ControlProperties {
  const own = { name, ...parseControlCanvasItem({}, name), ...properties } as ControlProperties;
  return {
    ...own,
    ...(variation !== undefined && { themeTypeVariation: variation }),
    ...(pushedFontSizes && {
      themeOverrideFontSizes: { ...own.themeOverrideFontSizes, ...pushedFontSizes },
    }),
  };
}

/** The `textureSlots` key of the theme icon `icon` that a Control of `type`, built with no variation, resolves. */
function builtButtonIconKey(type: string): string {
  return `built:${type}`;
}

/** One request for the theme icon `icon` of each Button class in `types`, for those the owner's theme chain gives one. */
export function builtButtonIconRequests(
  types: readonly string[],
  builtIcons?: BuiltIconsFn
): TextureSlotRequest[] {
  const requests: TextureSlotRequest[] = [];
  for (const type of types) {
    const themed = builtIcons?.(type).icon;
    if (themed) requests.push(themedSlotRequest(builtButtonIconKey(type), themed));
  }
  return requests;
}

/**
 * The size of the theme icon `icon` a built Button draws, for one that sets no icon of its own. A
 * variation is null: its slot is not requested, and its own `icon` entry would size it.
 */
function builtButtonTextureSize(
  owner: SolveNode,
  { type, variation, properties }: InternalControlSpec,
  items: InternalThemeItems
): SolveNode['textureSize'] {
  if ((properties as ButtonProperties).icon || !items.icons.icon) return null;
  if (variation !== undefined || !descendsFromClass(type, 'Button')) return null;
  return owner.textureSlots[builtButtonIconKey(type)] ?? null;
}
