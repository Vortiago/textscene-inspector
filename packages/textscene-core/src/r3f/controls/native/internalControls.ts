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
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { ButtonProperties } from '../../../nodes/2d/ui/button/types';
import type { NativeTheme } from './nativeTheme';
import type { SolveNode } from './solveTree';
import {
  themedSlotRequest,
  type BuiltIconsFn,
  type SolveContext,
  type TextureSlotRequest,
} from './solverRegistry';
import { internalChildThemeItems, type InternalThemeItems } from './themeItems';
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
   * The parsed properties, defaults included. Runtime state that no scene line carries goes here too,
   * as `ButtonProperties.hasFocus` and `ButtonProperties.themeIcon` do.
   */
  properties: object;
  children?: readonly InternalControlSpec[];
  /** The `theme_type_variation` the constructor sets. */
  variation?: string;
  /** Icons the parent's theme gives it, by name. Any the parent's theme chain gives its type override them. */
  icons?: SolveNode['icons'];
  /** Set where the constructor sizes the Control's texture itself. Otherwise a built Button reads its theme icon's slot. */
  textureSize?: SolveNode['textureSize'];
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
) => ReadonlyMap<string, Rect2>;

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
const NO_PLACEMENTS: readonly { node: SolveNode; rect: Rect2 }[] = Object.freeze([]);

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

/** The internal Controls of `parent`, built once for each (parent, theme). Empty for a class that registers none. */
export function internalControlsOf(parent: SolveNode, theme: NativeTheme): readonly InternalControl[] {
  const registration = registrationOf(parent);
  if (!registration) return NONE;
  const byTheme = builtByParent(parent);
  const known = byTheme.get(theme);
  if (known) return known;
  const built = registration.build(parent, theme).map(({ mode, spec }) => ({
    mode,
    node: internalControlNode(parent, spec),
  }));
  byTheme.set(theme, built);
  return built;
}

/** Each top-level internal Control of `parent` with the rect its class's layout gives it. */
export function placeInternalControls(
  parent: SolveNode,
  rect: Rect2,
  ctx: SolveContext
): readonly { node: SolveNode; rect: Rect2 }[] {
  const registration = registrationOf(parent);
  if (!registration) return NO_PLACEMENTS;
  const internals = internalControlsOf(parent, ctx.theme);
  const rects = registration.layout(parent, internals, rect, ctx);
  return internals.map(({ node }) => ({ node, rect: rects.get(node.path) ?? ZERO_RECT }));
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
  const { type, name, variation } = spec;
  const path = syntheticPath(parentPath, name);
  const node: TscnNode = {
    name,
    type,
    children: [],
    properties: spec.properties as ControlProperties,
    rawProperties: {},
  };
  const items = internalChildThemeItems(owner, type, variation);
  const textureSize =
    spec.textureSize !== undefined ? spec.textureSize : builtButtonTextureSize(owner, spec, items);
  return {
    ...owner,
    path,
    node,
    children: (spec.children ?? []).map((child) => buildUnder(owner, child, path)),
    styleBoxes: items.styleBoxes,
    colors: items.colors,
    constants: items.constants,
    icons: { ...spec.icons, ...items.icons },
    fontOverrides: {},
    textureSize,
    textureSlots: {},
    labelSettings: null,
    labelSettingsFont: null,
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
