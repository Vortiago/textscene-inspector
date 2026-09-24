/**
 * The INT-slot population, and a literal shaped for each slot, shared by
 * `nonFiniteInts` and `truncatedInts`. A probe of the wrong shape, such as a bare
 * `inf` for a `PackedInt32Array`, is a format error that tests nothing.
 */

import { everyValidator } from '../registryPopulation.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

const NESTED_INT_ARRAY = /^Array\[PackedInt32Array\]|index lists/;
const PACKED_INT_ARRAY = /PackedInt32Array/;

/** A literal of the right shape for `accepts`, carrying `spelling` in one slot. */
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
 * Every tagged int slot the registry resolves, dispatchers descended, since a
 * one-level walk misses a slot behind `settings/#/*` or `layer_#/tile_data`.
 * `everyValidator` dedupes a leaf that two dispatchers share.
 */
export function taggedIntSlots(): IntSlot[] {
  return everyValidator((validator) => validator.intSlot !== undefined).map(
    // `key` is the registration the root resolved under, at every depth: a leaf
    // reads `name` from its closure and uses `key` only to address the
    // diagnostic. The label would read `settings/*[0]` at depth 2.
    ({ label, key, validator }) => ({ at: label, key, validator })
  );
}
