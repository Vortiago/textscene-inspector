/**
 * Properties that POINT at something: a resource reference, the nullable form
 * Godot writes for a cleared slot, and a node path.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import {
  RESOURCE_REFERENCE_REGEX,
  createNodePathValidator,
  createResourceReferenceValidator,
} from '../resourceValidators.js';
import { formatCode, upper } from './codes.js';
import { accepts, shape } from './grounding.js';

export const referenceCombinators = {
  /** `SubResource("id")` or `ExtResource("id")` format. */
  resourceReference(name: string): PropertyValidator {
    return shape(
      createResourceReferenceValidator(
      name,
      `INVALID_${upper(name)}_REFERENCE`
    ),
      'SubResource("id") or ExtResource("id")'
    );
  },

  /**
   * `SubResource("id")`, `ExtResource("id")` or the literal `null`.
   *
   * The spelling Godot writes for an OPTIONAL resource slot: the serialiser
   * emits `null` rather than omitting the key when a scene has cleared one that
   * a sibling index still sets. Format-only, so no citation — a setter that
   * takes a `Ref<T>` takes a null one too.
   */
  nullableResourceReference(name: string): PropertyValidator {
    return shape(
      accepts((key, value, line) => {
        if (value === 'null' || RESOURCE_REFERENCE_REGEX.test(value)) return null;
        return propertyError(
          key,
          line,
          `Property '${name}' must be null, SubResource("id"), or ExtResource("id"), got: "${value}"`,
          formatCode(name)
        );
      }, 'null, SubResource("id"), or ExtResource("id")'),
      'null, SubResource("id"), or ExtResource("id")'
    );
  },

  /** `NodePath("path/to/node")` format. */
  nodePath(name: string): PropertyValidator {
    return shape(
      createNodePathValidator(name, `INVALID_${upper(name)}_PATH`),
      'NodePath("path/to/node")'
    );
  },
};
