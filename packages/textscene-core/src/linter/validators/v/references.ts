/**
 * Properties that POINT at something: a resource reference and a node path.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { createNodePathValidator, createResourceReferenceValidator } from '../resourceValidators.js';
import { upper } from './codes.js';
import { accepts, shape } from './grounding.js';

export const referenceCombinators = {
  /**
   * `SubResource("id")`, `ExtResource("id")` or the literal `null`.
   *
   * `null` is accepted for EVERY resource slot, which is a load-side fact and
   * not a write-side one. Godot's serialiser normally omits a cleared slot
   * rather than writing `null` (only a `PROPERTY_USAGE_STORE_IF_NULL` property
   * such as GraphNode's slot icons writes it), so it is tempting to reject the
   * spelling. That inference is wrong: `variant_parser.cpp:699` reads a bare
   * `null` as `Variant()`, `Variant::can_convert_strict` allows `NIL -> OBJECT`
   * (variant.cpp:543), and a `Ref<T>` setter takes an invalid Ref without
   * complaint. So a hand-edited `environment = null` LOADS, and reporting it is
   * a false positive on a file the engine opens.
   *
   * Whether a slot SHOULD be filled is a semantic rule's question, with its own
   * grounding, not this validator's: the two phases split exactly there.
   *
   * A setter that genuinely refuses a null Ref with `ERR_FAIL_NULL` would need
   * a stricter validator and a citation for it. None has been found.
   */
  resourceReference(name: string): PropertyValidator {
    return shape(
      accepts(
        createResourceReferenceValidator(name, `INVALID_${upper(name)}_REFERENCE`),
        'null, SubResource("id") or ExtResource("id")'
      ),
      'null, SubResource("id") or ExtResource("id")'
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
