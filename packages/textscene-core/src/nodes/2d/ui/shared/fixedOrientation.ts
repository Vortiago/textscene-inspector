/**
 * `vertical` is valid on a container base and INVALID on its fixed leaves.
 *
 * `BoxContainer`, `SplitContainer` and `FlowContainer` each declare a `vertical`
 * property, and each hides it again on the H/V subclasses: `_validate_property`
 * clears it to `PROPERTY_USAGE_NONE` when the class sets `is_fixed`, and the
 * setter refuses outright —
 *
 *     ERR_FAIL_COND_MSG(is_fixed, "Can't change orientation of " + get_class() + ".");
 *     — scene/gui/box_container.cpp:312, split_container.cpp:1120,
 *       flow_container.cpp:372
 *
 * So an `HBoxContainer` carrying `vertical = true` is a scene Godot can never
 * have written and would reject. The base-walk cannot express that on its own:
 * it only ever WIDENS what a leaf accepts, so once a leaf chains through its
 * base it inherits a validator that says the key is fine.
 *
 * This is the narrowing half. A fixed leaf registers it under `vertical`, which
 * shadows the inherited one — the single case where shadowing a base key is the
 * point rather than a mistake, because the leaf accepts strictly less.
 */

import { propertyError } from '../../../../linter/validators/propertyError.js';
import { accepts } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * Rejects `vertical` on a type whose orientation its class fixes.
 *
 * @param typeName - the concrete node type, named in the message so the reader
 *   is told which class fixed the orientation rather than just "this node".
 */
export function fixedOrientation(typeName: string): PropertyValidator {
  return accepts(
    // `_value` is never read: there is no value this class accepts, so the
    // check is on the key's presence alone.
    (key, _value, line) =>
      propertyError(
        key,
        line,
        `Property 'vertical' cannot be set on ${typeName}: its orientation is fixed by the class, and Godot rejects the assignment. Use a plain ${typeName.replace(
          /^[HV]/,
          ''
        )} if the orientation must vary.`,
        'INVALID_VERTICAL_VALUE'
      ),
    'nothing — orientation is fixed by the class'
  );
}
