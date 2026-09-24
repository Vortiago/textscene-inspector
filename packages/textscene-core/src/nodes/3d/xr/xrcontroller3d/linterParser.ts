/**
 * XRController3D strict validators for its own members, the ones doc/classes/XRController3D.xml lists
 * without `overrides=`. Keys from XRNode3D up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

import '../xrnode3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('XRController3D', {});
