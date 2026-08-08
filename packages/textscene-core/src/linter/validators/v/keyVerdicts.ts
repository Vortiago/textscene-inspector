/**
 * The two combinators that never look at the value.
 *
 * One accepts every value because the property has no format Godot enforces;
 * the other rejects every value because the KEY is one the engine writes and
 * then refuses to read back. Both are verdicts on the key, which is why neither
 * belongs beside the format checks.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { formatCode } from './codes.js';
import { accepts, shape } from './grounding.js';

export const keyVerdictCombinators = {
  /**
   * Accepts anything. For a property that is recognised on the node but has no
   * format Godot enforces — saying so beats leaving the sheet's Accepts column
   * blank, which reads as "nobody tagged this".
   */
  any(): PropertyValidator {
    return shape(() => null, 'any value (no format constraint)');
  },

  /**
   * A key Godot SERIALISES but refuses to load back: `_get` produces it and
   * `_set` has no branch for it, so the write falls through to `return false`
   * and is dropped in silence.
   *
   * `Object::set` reaches `_setv` last (object.cpp:427) and a false return
   * leaves nothing but `r_valid = false`, which `SceneState::instantiate` passes
   * and never reads (packed_scene.cpp:492). That is ADR-0032's error row in its
   * strongest form, so this is `enforced` and takes a required `cite`.
   *
   * Not `registerUnavailable`, which models a key that never appears at all and
   * takes exact strings rather than the indexed patterns these keys carry.
   *
   * The derived `code` keeps the property path INCLUDING any slash, matching the
   * 68 existing assertions on codes like `INVALID_PARAMS/BIAS_VALUE`. Flattening
   * a multi-segment name to underscores is the outlier, not the fix.
   *
   * @param derivedFrom - what the engine computes it from, for the message.
   */
  readOnly(
    name: string,
    opts: { derivedFrom: string; cite: string; code?: string }
  ): PropertyValidator {
    const validator = accepts(
      (key, _value, line) =>
        propertyError(
          key,
          line,
          `Property '${key}' is read-only: derived from ${opts.derivedFrom}, and _set has no branch for it, so the write is dropped`,
          opts.code ?? formatCode(name, 'READONLY')
        ),
      `read-only (derived from ${opts.derivedFrom})`
    );
    validator.grounding = { kind: 'enforced', cite: opts.cite };
    return validator;
  },
};
