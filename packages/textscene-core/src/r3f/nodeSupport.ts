/**
 * Shared "does the previewer handle this node type?" check for the scene tree
 * and the inspector. A node is supported when it has a parser registration, a
 * render component, is the base `Node`, or is a recognised internal/synthetic
 * display type (created programmatically, not authored — e.g. the GLB scene
 * root and the synthetic nodes for a GLB's internal hierarchy). Without the
 * component-registry + internal-type checks, render-only types like
 * `GLBSceneRoot` were wrongly flagged "Not implemented" even though they render.
 */

import { nodeRegistry } from '../core/NodeRegistry.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';

/**
 * Synthetic node types with no parser registration that are nonetheless valid
 * to display (and select/hide) in the tree. The GLB-internal hierarchy types
 * are registered here.
 */
export const INTERNAL_DISPLAY_NODE_TYPES: ReadonlySet<string> = new Set<string>([]);

export function isRenderableNodeType(type: string): boolean {
  return (
    type === 'Node' ||
    // GLBSceneRoot + the synthetic GLB-internal hierarchy types (GLBMesh,
    // GLBBone, GLBNode, …) — all created programmatically, none authored.
    type.startsWith('GLB') ||
    nodeRegistry.getRegistration(type) !== null ||
    nodeComponentRegistry.get(type) !== undefined ||
    INTERNAL_DISPLAY_NODE_TYPES.has(type)
  );
}

/**
 * What the viewport will actually do with this type — the three-state the tree
 * and inspector badge on.
 *
 * `isRenderableNodeType` answers "do we know it?", and a *parser* registration
 * is enough to satisfy it. That conflates two very different situations once
 * broad parse coverage exists: a Timer draws nothing because drawing nothing is
 * correct, while a ProgressBar draws nothing because nobody has implemented it.
 * Reporting both as renderable would quietly retire the "Not implemented" badge
 * for every unimplemented type the parser learns to read.
 *
 * - `'draws'` — a component is registered and produces visible output.
 * - `'transform-only'` — a component is registered and deliberately draws
 *   nothing (ADR-0008); the node is finished.
 * - `'not-implemented'` — no component; `GenericNodeFallback` handles it.
 *
 * Control types are answered from `TWO_D_UI_TYPES`, not from
 * `controlComponentRegistry`: that registry is lazy and stays empty until the
 * 2D overlay mounts, so querying it would report every Control as unimplemented
 * whenever the viewport is in 3D mode. The set is a literal mirror of the
 * registry, held to it by `has2DUIContent.driftguard.test.ts`.
 */
export function rendersOwnVisual(type: string): 'draws' | 'transform-only' | 'not-implemented' {
  // Synthetic GLB types render through the GLB path, not a registration.
  if (type.startsWith('GLB') || INTERNAL_DISPLAY_NODE_TYPES.has(type)) return 'draws';
  if (TWO_D_UI_TYPES.has(type)) return 'draws';
  if (nodeComponentRegistry.get(type) === undefined) return 'not-implemented';
  return nodeComponentRegistry.isTransformOnly(type) ? 'transform-only' : 'draws';
}
