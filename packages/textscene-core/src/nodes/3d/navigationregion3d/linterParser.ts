/** NavigationRegion3D strict validators for linting (format validation). */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationRegion3D', {
  navigation_mesh: v.resourceReference('navigation_mesh'),
});
