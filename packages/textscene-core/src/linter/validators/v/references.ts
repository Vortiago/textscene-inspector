/** Properties that point at something: a resource reference and a node path. */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { createNodePathValidator, createResourceReferenceValidator } from '../resourceValidators.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';
import { isNilLiteral } from '../../../godot/index.js';

export const referenceCombinators = {
  /**
   * `SubResource("id")`, `ExtResource("id")` or `null`, which loads into every
   * resource slot: `variant_parser.cpp:699` reads it as `Variant()`, and
   * `can_convert_strict` allows `NIL -> OBJECT` (variant.cpp:543). Whether a slot
   * should be filled is a semantic rule's question.
   */
  resourceReference(name: string): PropertyValidator {
    // A setter that refuses a null Ref with `ERR_FAIL_NULL` needs a stricter
    // validator and its cite. None is known.
    return shape(
      createResourceReferenceValidator(name, formatCode(name, 'REFERENCE')),
      'null, SubResource("id") or ExtResource("id")'
    );
  },

  /**
   * `NodePath("path/to/node")` format. `orNull` is for a `Variant::OBJECT`
   * property that serialises as a NodePath (packed_scene.cpp:884-891), such as
   * `Control.shortcut_context` (control.cpp:4307). A `Variant::NODE_PATH` slot
   * refuses `null`, since only OBJECT takes NIL (variant.cpp:543-545).
   */
  nodePath(name: string, opts?: { orNull?: boolean }): PropertyValidator {
    const validator = createNodePathValidator(name, formatCode(name, 'PATH'));
    // `OpenXRCompositionLayer.layer_viewport` (openxr_composition_layer.cpp:151)
    // takes `orNull` too.
    if (!opts?.orNull) return shape(validator, 'NodePath("path/to/node")');
    return shape(
      (key, value, line) => (isNilLiteral(value) ? null : validator(key, value, line)),
      'null or NodePath("path/to/node")'
    );
  },
};
