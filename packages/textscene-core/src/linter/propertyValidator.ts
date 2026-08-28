/**
 * What a property validator IS, and what it declares about itself.
 *
 * Split out from `ValidatorRegistry.ts` because the type is the wider surface of
 * the two: every slice's `linterParser.ts` writes one, while only the linter
 * itself touches the registry that stores them. `ValidatorRegistry.ts` re-exports
 * it, so the import path a slice already uses is unchanged.
 */

import type { IntWidth } from '../godot/index.js';
import type { ParseError } from './types.js';

/**
 * Property validator function
 * @param key - Property key
 * @param value - Property value (raw string)
 * @param line - Line number in source file
 * @returns ParseError if validation fails, null if valid
 */
export type PropertyValidator = ((
  key: string,
  value: string,
  line: number
) => ParseError | null) & {
  /**
   * What this validator accepts, in one short human phrase — `float 0–1`,
   * `enum 0–3 (OFF/ON/…)`, `Vector3(x, y, z)`, `32-bit layer mask`.
   *
   * A validator is otherwise an opaque closure, so the generated `## Linting`
   * table could only list property NAMES and a reader had no way to see the
   * bounds. The `v` DSL knows them at construction time, so it tags them here
   * and `lintCoverage.mjs` renders them. Untagged validators simply render
   * blank rather than being guessed at.
   */
  accepts?: string;

  /**
   * True when this validator refuses a bare `null` on its OWN authority — the
   * setter opens with an `ERR_FAIL_COND(...is_null())`, so the write is refused
   * and nothing is stored.
   *
   * `TileSet.sources/<id>` (`add_source`, tile_set.cpp:477) and
   * `TileSet.pattern_<n>` (`add_pattern`, :1359) are the two. Both are OBJECT
   * slots, which is exactly where the strict parser's nil rewrite has nothing
   * true to say: `NIL -> OBJECT` is the one conversion `can_convert_strict`
   * allows, so no zero value is stored in place of the null — the add is simply
   * refused. Only this validator holds the `file:line` that says so.
   *
   * Separate from {@link ParseError.keyVerdict}, which answers the same seam
   * question for a different reason: there the class has no such slot at all.
   */
  nilVerdict?: true;

  /**
   * True when the ONLY thing this validator rejects is a value that never
   * reaches the property — `Color(1, 1)`, `not-a-float`, an unquoted string.
   * Such a rejection needs no citation, because no `.tscn` the engine loads
   * puts that value in this slot.
   *
   * "Never reaches the property", not "the parser could not read it": those
   * differ. Godot's tokenizer reads `Color(1, 1, 1, 1)` perfectly well, but
   * writing it to a `Vector2i` slot fails `can_convert_strict`
   * (`variant.cpp:536-830`) and `PackedScene` ignores the failure
   * (`packed_scene.cpp:492`), so the property keeps its default and the value
   * is nowhere. Both halves are still uncitable per PROPERTY, which is what
   * this flag is for — the authority is the Variant layer, one rule for every
   * slot, not a setter line. The composite grammars encode the conversion table
   * itself, so a spelling Godot DOES convert is accepted rather than rejected
   * here.
   *
   * It is a positive declaration rather than an inference: a validator with
   * neither this flag nor `grounding` is one nobody has classified, and
   * `boundGrounding.test.ts` fails on it. That is what stops a hand-rolled
   * validator from rejecting real values with nothing behind it — the failure
   * mode that let `GPUParticles3D.visibility_aabb` reject an extent Godot
   * assigns unaltered.
   */
  formatOnly?: boolean;

  /**
   * The per-sub-property validators a WILDCARD dispatcher forwards to.
   *
   * A key like `angular_limit_x/*` registers one dispatcher, and the sweep sees
   * only that function: tagging it satisfies the guard while an ungrounded leaf
   * sits behind it, checking `upper_angle` against a bound nobody verified.
   * Exposing the leaves is what lets the sweep recurse past the dispatcher.
   */
  leaves?: readonly PropertyValidator[];

  /**
   * Why the bound is the bound (ADR-0032), with the governing `file:line`.
   * `enforced` = Godot's setter refuses or alters the value, so out of range is
   * an error. `hinted` = only the PROPERTY_HINT_RANGE says so, so it is a
   * warning. Absent means the bound has not been audited yet.
   */
  grounding?: { kind: 'enforced' | 'hinted'; cite: string };

  /**
   * Set when this validator reads an INT slot, and so refuses a literal the
   * tokenizer reads but `_to_int` cannot carry.
   *
   * Separate from `grounding` on purpose. This claim is about the SLOT, the
   * same for every int property; `grounding` is about a BOUND, and differs per
   * property. Folding the two let a bounded int combinator inherit a citation
   * that vouched for a type conversion rather than for its range.
   */
  intSlot?: { cite: string; width: IntWidth };

  /**
   * The severity each BOUNDED end reports, for the ends that have a bound.
   *
   * `grounding.kind` collapses to `enforced` when either end is, which is right
   * for "does this bound need a citation" and wrong for "what happens if I
   * exceed it": `extra_cull_margin` has an enforced floor and a hinted ceiling,
   * so one end errors and the other warns. An end with no bound is absent here
   * rather than defaulted, because claiming a tier for an open end invents a
   * rejection the validator never makes.
   */
  tiers?: { min?: ParseError['severity']; max?: ParseError['severity'] };

  /**
   * The numeric bound this validator enforces, per end, for the ends it has.
   *
   * Recorded so a guard can ask what the code implements without reading the
   * source text around it. The engine's own `PROPERTY_HINT_RANGE` is captured
   * from a live ClassDB into `node-properties.json` and
   * `resource-properties.json`, so the two are directly comparable and the
   * comment quoting the hint stops being load-bearing.
   *
   * `min`/`max` are the OUTER ends, so where a hint states one it is the hint's
   * own number and that is what the ledger compares. `enforcedMin`/`enforcedMax`
   * are the setter's, further out and always an error, present only where the
   * two differ. Both are needed: one slot per end could not say that
   * `pitch_scale` is refused at `<= 0` and merely hinted from 0.01.
   */
  bounds?: {
    min?: number;
    max?: number;
    enforcedMin?: { at: number; exclusive?: boolean };
    enforcedMax?: { at: number; exclusive?: boolean };
  };
};

/**
 * Whether this refusal's own message already accounts for a bare `null`, so the
 * strict parser must not restate what the slot does with one.
 *
 * ONE question with two answers — the class has no such slot
 * ({@link ParseError.keyVerdict}), or the setter refuses the null
 * ({@link PropertyValidator.nilVerdict}) — asked once here rather than spelled
 * as a growing list of exemptions at the seam.
 *
 * The two answers sit on different objects because they are known at different
 * places. A `nilVerdict` slot is one the whole validator is about. A key
 * verdict is a per-branch fact: a family dispatcher reads the value in its leaf
 * branches and refuses a key in its unknown-leaf and negative-index ones, and
 * the registry hands this seam the dispatcher, so only the error carries it.
 */
export function ownsNilMessage(validator: PropertyValidator, error: ParseError): boolean {
  return validator.nilVerdict === true || error.keyVerdict === true;
}
