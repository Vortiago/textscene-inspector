/**
 * No INT-slot validator may be silent about a literal the slot cannot hold.
 *
 * The opposite of `nonFiniteScene.test.ts`: a FLOAT slot stores `inf` verbatim,
 * an INT slot cannot hold it. Measured on 4.6.3, `cast_shadow = inf` stores 0
 * against a default of 1 and `max_slides = inf` trips
 * `ERR_FAIL_COND(p_max_slides < 1)` (character_body_2d.cpp:614) — altered or
 * refused, which is ADR-0032's error tier.
 *
 * Population comes from the `intSlot` TAG, not from `accepts` prose. The
 * earlier `accepts` regex selected 492 of 542 slots, silently excluding every
 * layer mask (`layerBitmask` overwrites the tag) and every packed-int slot.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js'; // side-effect: every slice registers its validators

/** The four spellings Godot's tokenizer resolves (`variant_parser.cpp:701-707`). */
const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'] as const;

/**
 * A literal Godot reads and no 32-bit slot holds: past the unsigned ceiling for
 * an INT token, past int32 for a FLOAT one (`variant.h:367-370`).
 */
const UNSTORABLE = ['4294967296', '1e20'] as const;

/** Everything an int slot must refuse. */
const REFUSED = [...NON_FINITE, ...UNSTORABLE];

/**
 * A literal of the right SHAPE for `accepts`, carrying `spelling` in one slot.
 *
 * Every arm has to produce a literal the validator's own format branch accepts,
 * or the probe reports a format error and the sweep passes for the wrong
 * reason. `controlProbe` is what proves each arm does.
 */
function probe(accepts: string, spelling: string): string {
  if (accepts.startsWith('Vector2i')) return `Vector2i(${spelling}, 0)`;
  if (accepts.startsWith('Vector3i')) return `Vector3i(${spelling}, 0, 0)`;
  if (accepts.startsWith('Vector4i')) return `Vector4i(${spelling}, 0, 0, 0)`;
  if (accepts.startsWith('Rect2i')) return `Rect2i(${spelling}, 0, 1, 1)`;
  if (accepts.startsWith('Dictionary literal'))
    return `{ "cells": PackedInt32Array(${spelling}, 0, 0) }`;
  if (/^Array\[PackedInt32Array\]|index lists/.test(accepts))
    return `[PackedInt32Array(${spelling}, 0, 0)]`;
  if (/PackedInt32Array/.test(accepts)) return `PackedInt32Array(${spelling}, 0, 0)`;
  return spelling;
}

/** The same shape carrying a value every int slot accepts. */
function controlProbe(accepts: string): string {
  return probe(accepts, '1');
}

const intSlots = validatorRegistry.getRegisteredNodeTypes().flatMap((type) =>
  validatorRegistry
    .getOwnKeys(type)
    .map((key) => ({ type, key, validator: validatorRegistry.findValidator(type, key)! }))
    .filter(({ validator }) => validator?.intSlot !== undefined)
);

describe('a literal an INT slot cannot hold', () => {
  it('has int slots to ask about, so an empty registry cannot pass this', () => {
    expect(intSlots.length).toBeGreaterThan(500);
  });

  it('covers the shapes an `accepts` regex could not see', () => {
    // The three kinds the previous population missed, each named by the review
    // that found it: a layer mask (its `accepts` says "32-bit layer mask", not
    // "bit mask"), a packed-int array, and a packed stream inside a Dictionary.
    const covered = new Set(intSlots.map(({ type, key }) => `${type}.${key}`));
    for (const slot of [
      'CanvasItem.light_mask',
      'VisualInstance3D.layers',
      'SoftBody3D.pinned_points',
      'GridMap.data',
      'Polygon2D.polygons',
      'SplitContainer.split_offsets',
      'CodeEdit.line_length_guidelines',
    ]) {
      expect(covered).toContain(slot);
    }
  });

  it('reaches every slot with a literal of the SHAPE that slot reads', () => {
    // Without this the sweep below is vacuous wherever `probe` guesses the
    // wrong shape: a bare `inf` handed to a PackedInt32Array validator is a
    // FORMAT error, which counts as "not silent" while testing nothing.
    //
    // A control value may still be out of RANGE — `CSGSphere3D.radial_segments`
    // has a floor of 3 — so the question is only whether the format branch
    // fired, which is what an `_FORMAT` code says.
    const unreadable = intSlots
      .map(({ type, key, validator }) => ({
        at: `${type}.${key}`,
        probe: controlProbe(validator.accepts ?? ''),
        code: validator(key, controlProbe(validator.accepts ?? ''), 1)?.code ?? '',
      }))
      .filter(({ code }) => code.endsWith('_FORMAT'))
      .map(({ at, probe: text }) => `${at} cannot read ${text}`)
      .sort();
    expect(unreadable).toEqual([]);
  });

  it.each(REFUSED)('is reported by every int validator (%s)', (spelling) => {
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
      .flatMap(({ type, key, validator }) =>
        REFUSED.map((spelling) => ({
          at: `${type}.${key} (${spelling})`,
          severity: validator(key, probe(validator.accepts!, spelling), 1)?.severity,
        }))
      )
      .filter(({ severity }) => severity !== undefined && severity !== 'error')
      .map(({ at, severity }) => `${at} is ${severity}`)
      .sort();
    expect(wrongTier).toEqual([]);
  });

  it('never prints the stored number, which no two platforms agree on', () => {
    // The FLOAT branch is UB; see intSlot.ts. The message may name the literal only.
    const printsIt = intSlots
      .flatMap(({ type, key, validator }) =>
        REFUSED.map((spelling) => ({
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
