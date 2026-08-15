/**
 * No INT-slot validator may be silent about a non-finite literal.
 *
 * The opposite of `nonFiniteScene.test.ts`: a FLOAT slot stores `inf` verbatim,
 * an INT slot cannot hold it. Measured on 4.6.3, `cast_shadow = inf` stores 0
 * against a default of 1 and `max_slides = inf` trips
 * `ERR_FAIL_COND(p_max_slides < 1)` (character_body_2d.cpp:614) — altered or
 * refused, which is ADR-0032's error tier.
 *
 * Population derived from each validator's own `accepts` tag, so a new
 * registration is covered without touching this file.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js'; // side-effect: every slice registers its validators

/** The four spellings Godot's tokenizer resolves (`variant_parser.cpp:701-707`). */
const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'] as const;

/** An `accepts` tag that claims an INT slot. */
const INT_SLOT = /integer|^enum |bit mask|Vector2i|Vector3i|Vector4i|Rect2i/;

/** A literal of the right SHAPE for `accepts`, carrying `spelling` in one component. */
function probe(accepts: string, spelling: string): string {
  if (accepts.startsWith('Vector2i')) return `Vector2i(${spelling}, 0)`;
  if (accepts.startsWith('Vector3i')) return `Vector3i(${spelling}, 0, 0)`;
  if (accepts.startsWith('Vector4i')) return `Vector4i(${spelling}, 0, 0, 0)`;
  if (accepts.startsWith('Rect2i')) return `Rect2i(${spelling}, 0, 1, 1)`;
  return spelling;
}

describe('a non-finite literal in an INT slot', () => {
  const intSlots = validatorRegistry.getRegisteredNodeTypes().flatMap((type) =>
    validatorRegistry
      .getOwnKeys(type)
      .map((key) => ({ type, key, validator: validatorRegistry.findValidator(type, key)! }))
      .filter(({ validator }) => INT_SLOT.test(validator.accepts ?? ''))
  );

  it('has int slots to ask about, so an empty registry cannot pass this', () => {
    expect(intSlots.length).toBeGreaterThan(400);
  });

  it.each(NON_FINITE)('is reported by every int validator (%s)', (spelling) => {
    const silent = intSlots
      .filter(({ key, validator }) => validator(key, probe(validator.accepts!, spelling), 1) === null)
      .map(({ type, key }) => `${type}.${key}`)
      .sort();
    expect(silent).toEqual([]);
  });

  it('reports it as an ERROR, never as a hint-tier warning', () => {
    // The setter alters or refuses the write; a hint warning would be the
    // wrong tier for a value the engine changes.
    const wrongTier = intSlots
      .map(({ type, key, validator }) => ({
        at: `${type}.${key}`,
        severity: validator(key, probe(validator.accepts!, 'inf'), 1)?.severity,
      }))
      .filter(({ severity }) => severity !== undefined && severity !== 'error')
      .map(({ at, severity }) => `${at} is ${severity}`)
      .sort();
    expect(wrongTier).toEqual([]);
  });

  it('never prints the stored number, which no two platforms agree on', () => {
    // float->int32 is UB; see intSlot.ts. The message may name the literal only.
    const printsIt = intSlots
      .flatMap(({ type, key, validator }) =>
        NON_FINITE.map((spelling) => ({
          at: `${type}.${key} (${spelling})`,
          message: validator(key, probe(validator.accepts!, spelling), 1)?.message ?? '',
        }))
      )
      .filter(({ message }) => /-?2147483648|-?9223372036854775808|Infinity|NaN/.test(message))
      .map(({ at }) => at)
      .sort();
    expect(printsIt).toEqual([]);
  });
});
