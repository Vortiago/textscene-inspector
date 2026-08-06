/**
 * `SolveNode` — the Control rect solver's input shape. Built by the
 * `liveSceneTree`-based walker (packet P3, `native/buildSolveTree.ts`); this
 * module only defines the type, so the solver (this packet) and the walker
 * (P3) can be developed against the same contract without either depending on
 * the other's implementation.
 *
 * Pure data, no React, no THREE.
 */

import type { TscnNode } from '../../../parser/types';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { FontResource } from '../../../resources/processing/fontProcessing';
import type { ThemeResource } from '../../../resources/processing/themeProcessing';
import type { Vec2 } from './rect';
import type { StyleBoxFlatData } from './styleBoxFlat';

// Re-exported for existing importers of the type from its former home —
// `native/styleBoxFlat.ts` is the single definition now.
export type { StyleBoxFlatData };

/**
 * One Control (or 2D-UI node) in the live, already-collapsed scene tree —
 * instance roots merged, sub-scene scope resolved — ready for the solver.
 */
export interface SolveNode {
  /** Dispatcher-absolute path, from the live scene tree. */
  path: string;
  /** The COLLAPSED live node (post instance-merge). */
  node: TscnNode;
  /** From `liveChildGroups`; each child's own scope is already resolved. */
  children: readonly SolveNode[];
  /** This node's `theme_override_styles/*` StyleBoxes, resolved in ITS scope. */
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>>;
  /** `null` until the node's texture (if any) has loaded. */
  textureSize: Vec2 | null;
  /**
   * This node's OWN `theme_override_fonts/*`, resolved in ITS scope. Presence
   * of a key means it was AUTHORED (`Control::get_theme_font`'s local-override
   * branch has no validity check) — the value is `null` when the ref failed to
   * resolve. `buildSolveTree.ts` always sets this to `{}` at minimum, so every
   * producer of a `SolveNode` is total; required here (rather than defaulted
   * via `?? {}` at each read site) so a hand-built test literal that omits it
   * fails to compile instead of silently resolving no font — this repo has
   * been bitten twice by an optional input a test could leave out while
   * production never does. `testing/solveNode.ts`'s `solveNode()` factory
   * supplies the empty default for a literal that does not care.
   */
  fontOverrides: Readonly<Record<string, FontResource | null>>;
  /**
   * Nearest-first ancestor Controls' resolved `theme` — this node's own
   * `theme`, if it has one, is index 0 (`Control::get_theme_font`'s ancestor
   * walk, `scene/theme/theme_owner.cpp`'s `ThemeOwner::_get_next_owner_node`).
   * An ancestor Control with NO `theme` set contributes no entry. Feeds
   * `themeProcessing.ts`'s `resolveThemeFont`/`resolveThemeFontSizePx`.
   * Required — see `fontOverrides`'s own doc for why.
   */
  themeChain: readonly ThemeResource[];
  /**
   * The project's default theme (`gui/theme/custom`), resolved; `null` when
   * unset/unresolved/failed. Required — see `fontOverrides`'s own doc for why.
   */
  projectTheme: ThemeResource | null;
}

/**
 * This node's properties as the Control base type.
 *
 * Lives beside `SolveNode` because every solver and painter needs it and the
 * cast is the same one every time — the parser produces the properties bag and
 * the slice knows which shape it authored. Duplicating the one-liner per slice
 * is how a second, subtly different cast eventually appears.
 */
export function controlProps(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}
