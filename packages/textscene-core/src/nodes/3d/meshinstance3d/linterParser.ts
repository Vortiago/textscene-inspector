/**
 * MeshInstance3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const CAST_SHADOW = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
const GI_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };
const GI_LIGHTMAP_SCALE = { 0: '1x', 1: '2x', 2: '4x', 3: '8x' };
const VISIBILITY_FADE_MODE = { 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' };

validatorRegistry.registerAll('MeshInstance3D', {
  cast_shadow: v.enumInt('cast_shadow', 0, 3, CAST_SHADOW),
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
  layers: v.int('layers', {
    min: 1,
    max: 1048575,
    message:
      "Property 'layers' must be between 1 and 1048575. Valid range: bits 1-20",
  }),
  mesh: v.resourceReference('mesh'),
  material_override: v.resourceReference('material_override'),
  material_overlay: v.resourceReference('material_overlay'),
  skeleton: v.nodePath('skeleton'),
  skin: v.resourceReference('skin'),
  'surface_material_override/*': v.resourceReference('surface_material_override'),
});
