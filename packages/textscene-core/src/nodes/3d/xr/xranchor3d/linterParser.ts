/**
 * XRAnchor3D strict validators for linting.
 *
 * Declare only XRAnchor3D's OWN members — the ones doc/classes/XRAnchor3D.xml
 * lists without an `overrides=` attribute. Everything from XRNode3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../xrnode3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('XRAnchor3D', {});
