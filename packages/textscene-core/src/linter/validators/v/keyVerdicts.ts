/**
 * The combinators that never look at the value, since each is a verdict on the key: one accepts
 * every value of a property with no enforced format, and the others reject every value of a key
 * whose write the engine drops.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { keyShapeError } from '../propertyError.js';
import { formatCode } from './codes.js';
import { accepts, shape } from './grounding.js';

export const keyVerdictCombinators = {
  /**
   * Accepts anything, for a recognised property with no format Godot enforces.
   * The sheet's Accepts column says so instead of staying blank.
   */
  any(): PropertyValidator {
    return shape(() => null, 'any value (no format constraint)');
  },

  /**
   * A key Godot serialises but drops on load: `_set` has no branch for it, so
   * `Object::set` reaches `_setv` last (object.cpp:427) and `SceneState::instantiate`
   * never reads the false `r_valid` (packed_scene.cpp:492). ADR-0032's error row,
   * so it takes a required `cite`. Not `registerUnavailable`, which takes exact strings.
   *
   * @param derivedFrom - what the engine computes it from, for the message.
   */
  readOnly(name: string, opts: { derivedFrom: string; cite: string; code?: string }): PropertyValidator {
    // The derived code keeps any slash in the path, as `INVALID_PARAMS/BIAS_VALUE` does.
    const validator = accepts(
      (key, _value, line) =>
        keyShapeError(
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

  /**
   * A key ClassDB binds with no setter: `ClassDB::set_property` returns true and stores nothing
   * (class_db.cpp:1655-1659), so `Object::set` never reaches `_set`. ADR-0032's error row.
   */
  setterless(name: string): PropertyValidator {
    const validator = accepts(
      (key, _value, line) =>
        keyShapeError(
          key,
          line,
          `Property '${key}' has no setter, so Godot drops the write`,
          formatCode(name, 'READONLY')
        ),
      'read-only (bound with no setter)'
    );
    validator.grounding = { kind: 'enforced', cite: 'class_db.cpp:1655-1659' };
    return validator;
  },
};
