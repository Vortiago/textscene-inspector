/**
 * MeshInstance3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';
import { geometryInstance3dValidators } from '../shared/geometryInstance3dLinter.js';

const GI_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };
const GI_LIGHTMAP_SCALE = { 0: '1x', 1: '2x', 2: '4x', 3: '8x' };
const VISIBILITY_FADE_MODE = { 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' };

validatorRegistry.registerAll('MeshInstance3D', {
  ...geometryInstance3dValidators,
  gi_mode: v.enumInt('gi_mode', 0, 2, GI_MODE),
  gi_lightmap_scale: v.enumInt('gi_lightmap_scale', 0, 3, GI_LIGHTMAP_SCALE),
  visibility_range_begin: v.nonNegativeFloat('visibility_range_begin'),
  visibility_range_begin_margin: v.nonNegativeFloat('visibility_range_begin_margin'),
  visibility_range_end: v.nonNegativeFloat('visibility_range_end'),
  visibility_range_end_margin: v.nonNegativeFloat('visibility_range_end_margin'),
  visibility_range_fade_mode: v.enumInt(
    'visibility_range_fade_mode',
    0,
    2,
    VISIBILITY_FADE_MODE
  ),
  layers: layerBitmask('layers'),
  mesh: v.resourceReference('mesh'),
  material_override: v.resourceReference('material_override'),
  material_overlay: v.resourceReference('material_overlay'),
  skeleton: v.nodePath('skeleton'),
  skin: v.resourceReference('skin'),
  'surface_material_override/*': v.resourceReference('surface_material_override'),
});
