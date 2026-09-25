/**
 * OpenXRVisibilityMask strict validators for its own members, the ones doc/classes/OpenXRVisibilityMask.xml lists
 * without `overrides=`. Keys from VisualInstance3D up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

import '../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRVisibilityMask', {});
