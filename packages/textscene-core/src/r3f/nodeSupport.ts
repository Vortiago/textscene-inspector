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

/**
 * Synthetic node types with no parser registration that are nonetheless valid
 * to display (and select/hide) in the tree. The GLB-internal hierarchy types
 * (WI-C) are registered here.
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
