/**
 * OpenXRVisibilityMask strict validators for linting.
 *
 * Declare only OpenXRVisibilityMask's OWN members — the ones doc/classes/OpenXRVisibilityMask.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRVisibilityMask', {});
