/**
 * The INT-slot population, and a literal shaped for each slot in it.
 *
 * Two sweeps ask different questions of the same set — what a slot refuses
 * (`nonFiniteInts`) and what it reports as truncated (`truncatedInts`) — and
 * both need a probe of the SHAPE the slot reads: a bare `inf` handed to a
 * `PackedInt32Array` validator is a format error, which counts as "not silent"
 * while testing nothing.
 */

import { everyValidator } from '../registryPopulation.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

const NESTED_INT_ARRAY = /^Array\[PackedInt32Array\]|index lists/;
const PACKED_INT_ARRAY = /PackedInt32Array/;

/** A literal of the right SHAPE for `accepts`, carrying `spelling` in one slot. */
export function probe(accepts: string, spelling: string): string {
  if (accepts.startsWith('Vector2i')) return `Vector2i(${spelling}, 0)`;
  if (accepts.startsWith('Vector3i')) return `Vector3i(${spelling}, 0, 0)`;
  if (accepts.startsWith('Vector4i')) return `Vector4i(${spelling}, 0, 0, 0)`;
  if (accepts.startsWith('Rect2i')) return `Rect2i(${spelling}, 0, 1, 1)`;
  if (accepts.startsWith('Dictionary literal'))
    return `{ "cells": PackedInt32Array(${spelling}, 0, 0) }`;
  if (NESTED_INT_ARRAY.test(accepts)) return `[PackedInt32Array(${spelling}, 0, 0)]`;
  if (PACKED_INT_ARRAY.test(accepts)) return `PackedInt32Array(${spelling}, 0, 0)`;
  if (accepts.startsWith('PackedByteArray')) return `PackedByteArray(${spelling}, 0, 0)`;
  return spelling;
}

/** One tagged slot, addressable by the key its dispatcher routes for. */
export interface IntSlot {
  readonly at: string;
  readonly key: string;
  readonly validator: PropertyValidator;
}

/**
 * Every tagged int slot the registry RESOLVES, dispatchers descended.
 *
 * `getOwnKeys` + `findValidator` is a one-level walk, so a slot reached through
 * a wildcard dispatcher (`settings/#/*`, `layer_#/tile_data`) falls outside the
 * sweep entirely. `everyValidator` is the walk the classification guard uses,
 * and it dedupes a leaf shared by two dispatchers.
 */
export function taggedIntSlots(): IntSlot[] {
  return everyValidator((validator) => validator.intSlot !== undefined).map(
    // `key` is the registration the root resolved under, carried at every depth
    // — a leaf reads `name` from its closure and uses `key` only to address the
    // diagnostic, so the dispatcher's own key is what it wants. Derived from the
    // label instead, it read `settings/*[0]` at depth 2: the same two values,
    // disagreeing.
    ({ label, key, validator }) => ({ at: label, key, validator })
  );
}
