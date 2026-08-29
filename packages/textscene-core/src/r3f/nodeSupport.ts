/**
 * What the viewport will actually do with a node type — the three-state the
 * scene tree and the inspector badge on.
 */

import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';

/**
 * The badge's answer for `type`.
 *
 * A *parser* registration says nothing about drawing, and conflating the two
 * hides a gap: a Timer draws nothing because drawing nothing is correct, while
 * a ProgressBar draws nothing because nobody has implemented it. Reading a
 * parser registration as renderable retires the "Not implemented" badge for
 * every unimplemented type the parser learns to read.
 *
 * - `'draws'` — a component is registered and produces visible output.
 * - `'transform-only'` — a component is registered and deliberately draws
 *   nothing (ADR-0008); the node is finished.
 * - `'not-implemented'` — no component, or one registered `'pending'`: a base
 *   component holding the node's transform space open while its own visual is
 *   still missing.
 *
 * Control types are answered from `TWO_D_UI_TYPES`, not from
 * `controlComponentRegistry`: that registry is lazy and stays empty until the
 * 2D overlay mounts, so querying it would report every Control as unimplemented
 * whenever the viewport is in 3D mode. The set is a literal mirror of the
 * registry, held to it by `has2DUIContent.driftguard.test.ts`.
 */
export function rendersOwnVisual(type: string): 'draws' | 'transform-only' | 'not-implemented' {
  // Synthetic GLB types render through the GLB path, not a registration.
  if (type.startsWith('GLB')) return 'draws';
  // Ahead of every branch below, including the Control fallback: a declared gap
  // is the node's own claim about itself and nothing may promote it.
  if (nodeComponentRegistry.isPending(type)) return 'not-implemented';
  // A declared intent wins over the Control fallback below: a Control-family
  // type that registers `transform-only` must be able to say so, or its sheet
  // would be held to `linter-only` by sheets.test.mjs while the badge insisted
  // it draws — a contradiction no test could see.
  if (nodeComponentRegistry.isTransformOnly(type)) return 'transform-only';
  // Control types answer from the mirrored set, not the registry: see above.
  if (TWO_D_UI_TYPES.has(type)) return 'draws';
  return nodeComponentRegistry.get(type) === undefined ? 'not-implemented' : 'draws';
}
