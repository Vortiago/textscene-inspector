/** NavigationRegion2D strict validators for linting (format validation). */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationRegion2D', {
  navigation_polygon: v.resourceReference('navigation_polygon'),
});
