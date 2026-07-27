/**
 * PointLight2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PointLight2D', {
  blend_mode: v.enumInt('blend_mode', 0, 2, { 0: 'ADD', 1: 'SUB', 2: 'MIX' }),
  color: v.color('color'),
  enabled: v.boolean('enabled'),
  energy: v.nonNegativeFloat('energy'),
  offset: v.vector2('offset'),
  // Which CanvasItems this light reaches, and which occluders shadow it. Both
  // are ANDed against the item's own `light_mask`, and both are 32-bit.
  range_item_cull_mask: layerBitmask('range_item_cull_mask'),
  shadow_item_cull_mask: layerBitmask('shadow_item_cull_mask'),
  texture: v.resourceReference('texture'),
  texture_scale: v.nonNegativeFloat('texture_scale'),
});
