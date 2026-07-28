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
  shadow_enabled: v.boolean('shadow_enabled'),
  shadow_color: v.color('shadow_color'),
  shadow_filter: v.enumInt('shadow_filter', 0, 2, { 0: 'NONE', 1: 'PCF5', 2: 'PCF13' }),
  // Godot's inspector caps the kernel at 64 texels; the property is a plain
  // float, so a wider one parses in the engine but is out of the authored range.
  shadow_filter_smooth: v.float('shadow_filter_smooth', { min: 0, max: 64 }),
  texture: v.resourceReference('texture'),
  texture_scale: v.nonNegativeFloat('texture_scale'),
});
