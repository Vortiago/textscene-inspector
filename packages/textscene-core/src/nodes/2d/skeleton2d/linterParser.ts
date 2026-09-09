/**
 * Skeleton2D strict validators for linting.
 *
 * Declare only Skeleton2D's OWN members — the ones doc/classes/Skeleton2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * The XML lists no members at all and `_bind_methods` (skeleton_2d.cpp:817-831)
 * binds no `ADD_PROPERTY`, yet the class serialises one key: it takes the
 * property-list-override route instead, `_set`/`_get`/`_get_property_list` at
 * skeleton_2d.cpp:514/522/530. Reading only the XML or only `ADD_PROPERTY`
 * would have concluded, wrongly, that Skeleton2D declares nothing.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Skeleton2D', {
  // skeleton_2d.cpp:530-536 pushes one PropertyInfo: OBJECT
  // "modification_stack", PROPERTY_HINT_RESOURCE_TYPE
  // "SkeletonModificationStack2D", PROPERTY_USAGE_DEFAULT |
  // PROPERTY_USAGE_ALWAYS_DUPLICATE — DEFAULT carries STORAGE, so it lands in
  // the .tscn as a resource reference.
  //
  // Format only. set_modification_stack (skeleton_2d.cpp:748-763) releases the
  // previous stack and assigns the new one with no ERR_FAIL, no clamp and no
  // null guard, so ADR-0032 leaves nothing to bound. The hint narrows the
  // inspector's resource picker, not the engine, and checking it would need the
  // scene the reference resolves against, which a per-property validator never
  // sees.
  modification_stack: v.resourceReference('modification_stack'),
});
