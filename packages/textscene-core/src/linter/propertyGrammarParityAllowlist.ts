/**
 * Every parser/linter asymmetry this repo has justified, keyed by node type.
 *
 * The entries live in `propertyGrammarParityAllowlist/`, one part per node
 * family, and this module merges them; `propertyGrammarParity.test.ts` is the
 * guard that reads it. Nothing outside a test imports it, so it reaches no
 * shipped bundle.
 */

// ---------------------------------------------------------------------------
// Allowlist of known, justified asymmetries.
//
// "parserOnly"  — parser reads this property for rendering but no linter
//                 validator is registered (acceptable: the renderer needs it,
//                 the linter has nothing to check).
// "linterOnly"  — linter validates this key and the parser never reads it
//                 BECAUSE THERE IS NOTHING TO READ: the property cannot change
//                 a frozen frame.
// "renderGap"   — linter validates this key, the property DOES change a frozen
//                 frame, and the renderer has not implemented it yet.
//
// The last two both suppress the failure, so the split is not about the guard:
// it is about not letting a bug masquerade as a decision. Pick by asking one
// question — would Godot draw this scene differently? — and never by asking
// whether the key looks important.
//
// Shared keys that span every Node2D or Node3D leaf are recorded on the base
// type (Node2D / Node3D) and inherited automatically; leaf-specific entries
// only contain keys that are unique to that slice.
// ---------------------------------------------------------------------------

import { mergeDisjoint } from './mergeDisjoint.js';
import type { AsymmetryEntry } from './propertyGrammarParityAllowlist/types.js';
import { animationAndAudioAsymmetries } from './propertyGrammarParityAllowlist/animationAndAudio.js';
import { baseTypeAsymmetries } from './propertyGrammarParityAllowlist/baseTypes.js';
import { controlAsymmetries } from './propertyGrammarParityAllowlist/controls.js';
import { nodes2dAsymmetries } from './propertyGrammarParityAllowlist/nodes2d.js';
import { nodes3dAsymmetries } from './propertyGrammarParityAllowlist/nodes3d.js';
import { visuals3dAsymmetries } from './propertyGrammarParityAllowlist/visuals3d.js';

export type { AsymmetryEntry } from './propertyGrammarParityAllowlist/types.js';

export const ASYMMETRY_ALLOWLIST: Readonly<Record<string, AsymmetryEntry>> = mergeDisjoint(
  [
    baseTypeAsymmetries,
    controlAsymmetries,
    nodes2dAsymmetries,
    nodes3dAsymmetries,
    visuals3dAsymmetries,
    animationAndAudioAsymmetries,
  ],
  'allowlist entries'
);
