/** What the viewport does with a node type: the three-state the scene tree and the inspector badge on. */

import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/packedScene.js';

/**
 * The badge's answer for `type`: `'draws'`, `'transform-only'` for a component
 * that draws nothing on purpose (ADR-0008), or `'not-implemented'` for no component
 * or a `'pending'` one. A parser registration says nothing about drawing: a Timer
 * draws nothing correctly, while an unimplemented type draws nothing as a gap.
 */
export function rendersOwnVisual(type: string): 'draws' | 'transform-only' | 'not-implemented' {
  // Synthetic GLB types render through the GLB path, not a registration.
  if (type.startsWith('GLB')) return 'draws';
  // No slice registers it: `instance_placeholder=` builds an InstancePlaceholder
  // with no children that draws nothing until `create_instance`
  // (`packed_scene.cpp:255`), which is its finished behaviour.
  if (type === INSTANCE_PLACEHOLDER_TYPE) return 'transform-only';
  // Ahead of every branch below, including the Control fallback: a declared gap
  // is the node's own claim about itself and nothing may promote it.
  if (nodeComponentRegistry.isPending(type)) return 'not-implemented';
  // A declared intent wins over the Control fallback below, or sheets.test.mjs
  // holds a `transform-only` Control's sheet to `linter-only` while the badge
  // says it draws.
  if (nodeComponentRegistry.isTransformOnly(type)) return 'transform-only';
  // `controlComponentRegistry` stays empty until the 2D overlay mounts, so
  // Controls answer from its mirror, held to it by `has2DUIContent.driftguard.test.ts`.
  if (TWO_D_UI_TYPES.has(type)) return 'draws';
  return nodeComponentRegistry.get(type) === undefined ? 'not-implemented' : 'draws';
}
