/**
 * Every justified parser and linter asymmetry, keyed by node type, merged from
 * one part per family in `propertyGrammarParityAllowlist/`. Only test code
 * imports it, so it reaches no shipped bundle.
 */

// Choose `linterOnly` or `renderGap` by one question: would Godot draw this
// scene differently? Never by whether the key looks important. A key every
// Node2D or Node3D leaf shares sits on that base type and is inherited.
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
