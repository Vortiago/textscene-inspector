/**
 * CanvasModulate strict validators — the `color` property.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CanvasModulate', {
  color: v.color('color'),
});
