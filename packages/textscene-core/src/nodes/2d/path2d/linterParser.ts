/**
 * Path2D strict validators for linting — the `curve` resource reference format.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Path2D', {
  curve: v.resourceReference('curve'),
});
