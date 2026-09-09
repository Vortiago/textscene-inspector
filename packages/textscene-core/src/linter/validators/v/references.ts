/**
 * Properties that POINT at something: a resource reference and a node path.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { createNodePathValidator, createResourceReferenceValidator } from '../resourceValidators.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';
import { isNilLiteral } from '../../../godot/index.js';

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
      createResourceReferenceValidator(name, formatCode(name, 'REFERENCE')),
      'null, SubResource("id") or ExtResource("id")'
    );
  },

  /**
   * `NodePath("path/to/node")` format.
   *
   * `orNull` is for the property that is declared `Variant::OBJECT` and merely
   * SERIALISES as a NodePath — `Control.shortcut_context` (control.cpp:4307)
   * and `OpenXRCompositionLayer.layer_viewport`
   * (openxr_composition_layer.cpp:151); packed_scene.cpp:884-891 converts the
   * live Node to `get_path_to(n)` on the way out. It is NOT a default, because
   * `can_convert_strict` lets NIL become OBJECT and nothing else
   * (variant.cpp:543-545): a genuine `Variant::NODE_PATH` property does not take
   * `null`, so widening every call site would accept a value Godot refuses.
   */
  nodePath(name: string, opts?: { orNull?: boolean }): PropertyValidator {
    const validator = createNodePathValidator(name, formatCode(name, 'PATH'));
    if (!opts?.orNull) return shape(validator, 'NodePath("path/to/node")');
    return shape(
      (key, value, line) => (isNilLiteral(value) ? null : validator(key, value, line)),
      'null or NodePath("path/to/node")'
    );
  },
};
