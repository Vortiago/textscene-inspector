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
