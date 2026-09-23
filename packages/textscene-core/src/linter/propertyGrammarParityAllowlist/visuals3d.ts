/**
 * The `VisualInstance3D` tier, the two leaves with their own surface-level
 * asymmetries, and the concrete lights.
 */

import type { AsymmetryEntry } from './types.js';

export const visuals3dAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // Registered on the base and delivered to every 3D visual by the base-walk.
  VisualInstance3D: {
    linterOnly: [
      // `layers` selects which Camera3D cull masks see the object. The previewer
      // has one camera and no cull masks, so no parser reads it.
      'layers',
    ],
    reason: 'Render layers are validated for format but unused: the previewer has one camera and no cull-mask filtering, so no parser reads them.',
  },

  Decal: {
    linterOnly: [
      // Godot serialises `sorting_offset` for a Decal (Decal::_validate_property
      // restores it from VisualInstance3D's PROPERTY_USAGE_NONE). It biases only
      // draw order among transparent surfaces.
      'sorting_offset',
    ],
    reason: 'sorting_offset is a real serialised Decal property, so the linter checks its format, but it only tunes transparency sort order and the renderer has nothing to do with it.',
  },

  MeshInstance3D: {
    parserOnly: [
      // Deprecated: `scene/3d/visual_instance_3d.cpp` binds `gi_lightmap_scale`
      // PROPERTY_USAGE_NONE, so Godot never writes it and it has no validator.
      // The parser reads it so an older hand-written scene still loads.
      'gi_lightmap_scale',
    ],
    linterOnly: [
      // A wildcard validator. The parser reads it in a loop over Object.keys,
      // which the properties.X scrape cannot see.
      'surface_material_override/*',
      // canvas_item.cpp's InstanceUniforms sibling for the 3D RS surface, as in
      // the inherited GeometryInstance3D entry.
      'instance_shader_parameters/*',
    ],
    renderGap: [
      // mesh_instance_3d.cpp:102-103: a morph-target weight Godot deforms the
      // mesh by. This previewer renders the rest pose.
      'blend_shapes/*',
    ],
    reason: 'MeshInstance3D linter uses a wildcard pattern for surface_material_override/N and instance_shader_parameters/N; the parser reads the former via an Object.keys loop not captured by the scrape and has no rendering surface for the latter at all. blend_shapes/<name> is a real, unimplemented morph-target rendering gap.',
  },

  // Lights: the shared validators and parseBaseLight* helpers are walked through
  // the Light3D entries in NODE_BASE_TYPES and BASE_TYPE_TO_PARSER_SUBPATH, and
  // base-level asymmetries sit on Light3D in baseTypes.ts.

  DirectionalLight3D: {
    linterOnly: [
      // Shadow-cascade and sky tuning the parser does not read.
      'directional_shadow_blend_splits', 'directional_shadow_fade_start',
      'directional_shadow_pancake_size',
      'directional_shadow_split_1', 'directional_shadow_split_2', 'directional_shadow_split_3',
      'sky_mode',
    ],
    reason: 'DirectionalLight3D linter validates additional shadow-cascade/sky tuning properties the static renderer ignores; the Light3D base keys are covered by the Light3D entry on both sides.',
  },

  OmniLight3D: {
    reason: 'No unique asymmetries; omni_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  SpotLight3D: {
    reason: 'No unique asymmetries; spot_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  AreaLight3D: {
    reason: 'No unique asymmetries; area_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },
};
