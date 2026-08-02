/**
 * A registered node type must declare validators for its own properties.
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
 * Two lists, and the difference between them matters. `NO_OWN_PROPERTIES` is a
 * statement of fact about Godot and is permanent. `UNDECLARED` is a defect
 * list: every entry is a type whose properties are currently unchecked, and it
 * only ever shrinks. A new type may join neither by accident.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

/**
 * Types Godot gives no serialisable properties of their own, so declaring none
 * is correct and complete. Each count is `doc/classes/<T>.xml` members without
 * an `overrides=` attribute, cross-checked against `ADD_PROPERTY` in the class's
 * `.cpp` — both zero. These are themed or layout-only refinements of an
 * ancestor, and everything they serialise arrives through the base-walk.
 */
const NO_OWN_PROPERTIES: Readonly<Record<string, string>> = {
  BoneConstraint3D: 'abstract base; the constraint parameters live on each subclass',
  CheckBox: 'a themed BaseButton; its constructor only changes inherited defaults',
  CheckButton: 'a themed BaseButton; its constructor only changes inherited defaults',
  Container: 'layout behaviour only, driven entirely by Control keys',
  HBoxContainer: "orientation only; the box keys are BoxContainer's",
  HSlider: "orientation only; the slider keys are Slider's",
  HSplitContainer: "orientation only; the split keys are SplitContainer's",
  MarginContainer: 'margins are theme constants, not properties',
  Panel: 'draws only its theme stylebox',
  PanelContainer: 'draws only its theme stylebox',
  Popup: "popup behaviour only; the geometry keys are Window's",
  VBoxContainer: "orientation only; the box keys are BoxContainer's",
  VSlider: "orientation only; the slider keys are Slider's",
  VSplitContainer: "orientation only; the split keys are SplitContainer's",
};

/**
 * Types with own properties that are still undeclared, and the count of members
 * each is missing. Every entry is a live gap: these properties are accepted
 * unchecked today. Removing an entry (by declaring its validators) is the only
 * correct edit; adding one is never correct.
 */
const UNDECLARED: Readonly<Record<string, number>> = {
  CanvasLayer: 9,
  CenterContainer: 1,
  ColorRect: 1,
  GridContainer: 1,
  Label: 22,
  LineEdit: 36,
  OptionButton: 4,
  RichTextLabel: 30,
  ScrollContainer: 11,
  TextureRect: 5,
};

/** Registered types declaring no validators of their own. */
function typesWithoutOwnValidators(): string[] {
  return nodeRegistry
    .getAllTypeNames()
    .filter((type) => validatorRegistry.getOwnKeys(type).length === 0)
    .sort();
}

describe('own-validator coverage', () => {
  it('accounts for every registered type that declares no validators', () => {
    const accounted = new Set([...Object.keys(NO_OWN_PROPERTIES), ...Object.keys(UNDECLARED)]);
    const unaccounted = typesWithoutOwnValidators().filter((type) => !accounted.has(type));

    // A type here parses but validates nothing of its own. Declare its
    // validators, or add it to NO_OWN_PROPERTIES if Godot truly gives it none.
    expect(unaccounted).toEqual([]);
  });

  it('keeps both lists free of types that now declare validators', () => {
    const stale = [...Object.keys(NO_OWN_PROPERTIES), ...Object.keys(UNDECLARED)]
      .filter((type) => nodeRegistry.getAllTypeNames().includes(type))
      .filter((type) => validatorRegistry.getOwnKeys(type).length > 0);

    // Stale entries make the gap look larger than it is and hide regressions.
    expect(stale).toEqual([]);
  });

  it('never lets the undeclared list grow', () => {
    // The ratchet. This number goes down and never up; each decrement is a type
    // whose properties stopped being silently accepted.
    expect(Object.keys(UNDECLARED).length).toBeLessThanOrEqual(10);
  });

  it('declares validators for Button, whose 13 members were the trigger', () => {
    expect(validatorRegistry.getOwnKeys('Button')).toHaveLength(13);
  });

  it('declares validators on Node, which every other type inherits', () => {
    // The widest gap of the twenty: Node is the terminal of every base chain,
    // so ten unchecked keys were unchecked on all 240 types at once.
    expect(validatorRegistry.getOwnKeys('Node')).toHaveLength(10);
  });

  it('covers the abstract tiers that no registered type can speak for', () => {
    // Slider binds five members and is not instantiable, so it appears in no
    // registry and this guard's registry-driven sweep cannot see it. HSlider
    // and VSlider bind nothing themselves, so without the tier their entire
    // surface below Range went unchecked.
    expect(validatorRegistry.getOwnKeys('Slider')).toHaveLength(5);
    expect(validatorRegistry.findValidator('HSlider', 'tick_count')).not.toBeNull();
  });
});
