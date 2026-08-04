/**
 * A node type must declare validators for its own properties.
 *
 * The coverage ledger counts **parser** registrations, so a slice that parses a
 * type but declares no validators reads as fully covered while
 * `StrictTscnParser` (`if (!validator) return;`) silently accepts every value
 * on it. That is the same silent shape `baseChainCompleteness` exists to
 * prevent, one level down: there the inherited keys go unchecked, here the
 * type's own ones do.
 *
 * It is not hypothetical. This guard was written after finding twenty
 * registered types in exactly that state, among them `Button` (13 own members),
 * `LineEdit` (36) and `RichTextLabel` (30) — all reading green in the ledger.
 *
 * The swept set is the registry PLUS every ancestor reachable from it. The
 * registry alone would be blind to exactly the types that carry the most
 * leverage: Godot's non-instantiable tiers (`Light3D`, `CollisionObject2D/3D`,
 * `Slider`, `Joint2D/3D`, `CanvasItem`, `Viewport`) appear in no `.tscn`, so
 * they register no parser, so a registry-driven sweep can never see one emptied
 * by a refactor. Closing over the base chain reaches them for free and keeps
 * reaching each new tier the day it is scaffolded.
 *
 * Two lists, and the difference between them matters. `NO_OWN_PROPERTIES` is a
 * statement of fact about Godot and is permanent. `UNDECLARED` is a defect
 * list: every entry is a type whose properties are currently unchecked, and it
 * only ever shrinks. A type may join neither by accident.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { baseChain } from './nodeBaseTypes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

/**
 * Types Godot gives no serialisable properties of their own, so declaring none
 * is correct and complete. Verified as `doc/classes/<T>.xml` members without an
 * `overrides=` attribute, cross-checked against `ADD_PROPERTY` in the class's
 * `.cpp` — both zero. These are themed, layout-only or orientation-only
 * refinements of an ancestor, and everything they serialise arrives through the
 * base-walk.
 */
const NO_OWN_PROPERTIES: Readonly<Record<string, string>> = {
  BoneConstraint3D: 'abstract base; the constraint parameters live on each subclass',
  CheckBox: 'a themed BaseButton; its constructor only changes inherited defaults',
  CheckButton: 'a themed BaseButton; its constructor only changes inherited defaults',
  Container: 'layout behaviour only, driven entirely by Control keys',
  HBoxContainer: "orientation only; the box keys are BoxContainer's",
  HFlowContainer: "orientation only; the flow keys are FlowContainer's",
  HSlider: "orientation only; the slider keys are Slider's",
  HSplitContainer: "orientation only; the split keys are SplitContainer's",
  MarginContainer: 'margins are theme constants, not properties',
  OpenXRBindingModifierEditor:
    'editor-only PanelContainer; its constructor only changes the inherited size_flags_horizontal default',
  OpenXRInteractionProfileEditor:
    'editor-only (TOOLS_ENABLED); _bind_methods binds methods only, and its abstract base declares nothing either',
  OpenXRInteractionProfileEditorBase:
    'abstract editor tier Godot cannot instantiate; binds no ADD_PROPERTY, so it owns no key to validate',
  Panel: 'draws only its theme stylebox',
  PanelContainer: 'draws only its theme stylebox',
  PhysicsBody2D: 'its one member, input_pickable, is overrides=CollisionObject2D',
  Popup: "popup behaviour only; the geometry keys are Window's",
  VBoxContainer: "orientation only; the box keys are BoxContainer's",
  VFlowContainer: "orientation only; the flow keys are FlowContainer's",
  VSlider: "orientation only; the slider keys are Slider's",
  VSplitContainer: "orientation only; the split keys are SplitContainer's",
};

/**
 * Types with own properties in Godot that this repo has not declared yet. Each
 * is a live gap: those properties are accepted unchecked today.
 *
 * Member counts at the time of writing, for scale rather than as an assertion
 * (nothing can verify them without reading `doc/classes` at test time, which
 * `godot-source-decoupling.test.mjs` forbids). Registered leaves: LineEdit 36,
 * RichTextLabel 30, Label 22, ScrollContainer 11, CanvasLayer 9, TextureRect 5,
 * OptionButton 4, CenterContainer 1, ColorRect 1, GridContainer 1.
 *
 * The six tiers below were invisible until this guard closed over the base
 * chain, and each one is worth more than a leaf because its keys reach every
 * descendant: SpriteBase3D 20 (Sprite3D, AnimatedSprite3D), Light2D 15
 * (PointLight2D, DirectionalLight2D), AnimationMixer 10 (AnimationPlayer,
 * AnimationTree), CSGShape3D 7 (every CSG node), PhysicsBody3D 6 — the
 * axis_lock set, reaching all four 3D bodies — and CSGPrimitive3D 1.
 *
 * Removing an entry (by declaring its validators) is the only correct edit.
 */
const UNDECLARED: readonly string[] = [
  'AnimationMixer',
  'CSGPrimitive3D',
  'CSGShape3D',
  'CanvasLayer',
  'CenterContainer',
  'ColorRect',
  'GridContainer',
  'Label',
  'Light2D',
  'LineEdit',
  'OptionButton',
  'PhysicsBody3D',
  'RichTextLabel',
  'ScrollContainer',
  'SpriteBase3D',
  'TextureRect',
];

/**
 * Every type this guard holds to account: the registry, closed over the base
 * chain so non-instantiable tiers are included.
 */
function typesUnderGuard(): string[] {
  const all = new Set(nodeRegistry.getAllTypeNames());
  for (const type of [...all]) {
    for (const ancestor of baseChain(type)) all.add(ancestor);
  }
  return [...all].sort();
}

/** Types under guard that declare no validators of their own. */
function typesWithoutOwnValidators(): string[] {
  return typesUnderGuard().filter((type) => validatorRegistry.getOwnKeys(type).length === 0);
}

describe('own-validator coverage', () => {
  it('accounts for every type that declares no validators', () => {
    const accounted = new Set([...Object.keys(NO_OWN_PROPERTIES), ...UNDECLARED]);
    const unaccounted = typesWithoutOwnValidators().filter((type) => !accounted.has(type));

    // A type here parses but validates nothing of its own. Declare its
    // validators, or add it to NO_OWN_PROPERTIES if Godot truly gives it none.
    expect(unaccounted).toEqual([]);
  });

  it('keeps both lists free of types that now declare validators', () => {
    const stale = [...Object.keys(NO_OWN_PROPERTIES), ...UNDECLARED].filter(
      (type) => validatorRegistry.getOwnKeys(type).length > 0
    );

    // Stale entries make the gap look larger than it is and hide regressions.
    expect(stale).toEqual([]);
  });

  it('never lets the undeclared list grow', () => {
    // The ratchet: a new gap cannot be waved through by appending to the list.
    // Each decrement is a type whose properties stopped being silently accepted.
    expect(UNDECLARED.length).toBeLessThanOrEqual(16);
  });

  it('declares validators for Button, whose 13 members were the trigger', () => {
    // The only place the exact count is pinned; button/linterParser.test.ts
    // asserts non-empty but not how many.
    expect(validatorRegistry.getOwnKeys('Button')).toHaveLength(13);
  });

  it('reaches the non-instantiable tiers, which register no parser', () => {
    // The whole point of closing over the base chain. These appear in no
    // `.tscn` and so in no registry; without the closure an emptied tier would
    // pass this guard silently.
    for (const tier of ['Light3D', 'CollisionObject2D', 'CollisionObject3D', 'Slider']) {
      expect(typesUnderGuard(), `${tier} is not under guard`).toContain(tier);
      expect(validatorRegistry.getOwnKeys(tier), `${tier} declares nothing`).not.toEqual([]);
    }
  });
});
