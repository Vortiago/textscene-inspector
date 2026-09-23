/**
 * What a property validator is, and what it declares about itself. Every slice
 * writes one, while only the linter touches the registry, so the type has its
 * own file. `ValidatorRegistry.ts` re-exports it.
 */

import type { IntWidth } from '../godot/index.js';
import type { ParseError } from './types.js';

/**
 * What the strict parser needs from a validator: something to call. It carries
 * none of the tags below, so a sweep that reads them off a `findValidator`
 * result, which reaches roots only, is a type error. A caller that wants the
 * tags asks `declarationFor`.
 *
 * @param key - Property key
 * @param value - Property value (raw string)
 * @param line - Line number in source file
 * @returns ParseError if validation fails, null if valid
 */
export type ValidatorFn = (key: string, value: string, line: number) => ParseError | null;

/**
 * A validator and what it declares about itself. One with neither `formatOnly`
 * nor `grounding` is unclassified, and `boundGrounding.test.ts` fails on it.
 */
export type PropertyValidator = ((
  key: string,
  value: string,
  line: number
) => ParseError | null) & {
  /**
   * What this validator accepts, in one short phrase: `float 0–1`,
   * `enum 0–3 (OFF/ON/…)`, `Vector3(x, y, z)`, `32-bit layer mask`. The `v` DSL
   * tags it, and `lintCoverage.mjs` renders it in the `## Linting` table. An
   * untagged validator renders blank.
   */
  accepts?: string;

  /**
   * True when this validator rejects only values that never reach the property,
   * which need no citation: unreadable text, or a type `can_convert_strict`
   * refuses (`variant.cpp:536-830`) and `PackedScene` then ignores
   * (`packed_scene.cpp:492`). A value Godot converts is accepted.
   */
  formatOnly?: boolean;

  /**
   * The per-sub-property validators a wildcard dispatcher such as
   * `angular_limit_x/*` forwards to, so the sweep recurses past the dispatcher
   * to each leaf's own bound.
   */
  leaves?: readonly PropertyValidator[];

  /**
   * Why the bound is the bound (ADR-0032), with the governing `file:line`.
   * `enforced`: Godot's setter refuses or alters the value, an error. `hinted`:
   * only the PROPERTY_HINT_RANGE says so, a warning. Absent: not yet audited.
   */
  grounding?: { kind: 'enforced' | 'hinted'; cite: string };

  /**
   * Set when this validator reads an INT slot, and so refuses a literal the
   * tokenizer reads but `_to_int` cannot carry. Apart from `grounding`, since it
   * is about the slot, while `grounding` is about a bound per property.
   */
  intSlot?: { cite: string; width: IntWidth };

  /**
   * The severity each bounded end reports. `grounding.kind` is `enforced` when
   * either end is, but `extra_cull_margin` errors at its floor and warns at its
   * ceiling. An open end is absent, since a tier would invent a rejection.
   */
  tiers?: { min?: ParseError['severity']; max?: ParseError['severity'] };

  /**
   * The numeric bound per end, for a guard to compare with the engine's
   * `PROPERTY_HINT_RANGE` from `node-properties.json` and
   * `resource-properties.json`.
   */
  bounds?: {
    // The outer ends: where a hint states one, the hint's own number.
    min?: number;
    max?: number;
    // The setter's, further out and always an error, present only where they
    // differ: `pitch_scale` is refused at `<= 0` and hinted from 0.01.
    enforcedMin?: { at: number; exclusive?: boolean };
    enforcedMax?: { at: number; exclusive?: boolean };
  };
};

/**
 * Whether this refusal's message already accounts for a bare `null`: the class
 * has no such slot ({@link ParseError.keyVerdict}), or the setter refuses it
 * ({@link ParseError.nilVerdict}). Both ride on the error, since `findValidator`
 * returns a dispatcher and `withFiniteGuard` a wrapper, not the refusing leaf.
 */
export function ownsNilMessage(error: ParseError): boolean {
  return error.keyVerdict === true || error.nilVerdict === true;
}
