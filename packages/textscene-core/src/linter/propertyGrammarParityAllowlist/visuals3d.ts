/**
 * The `VisualInstance3D` tier, the two leaves with their own surface-level
 * asymmetries, and the concrete lights.
 */

import type { AsymmetryEntry } from './types.js';

export const visuals3dAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // Registered on the base and delivered to every 3D visual by the base-walk,
  // so one entry here covers MeshInstance3D, Sprite3D, Label3D, Decal,
  // GPUParticles3D and the seven CSG shapes rather than twelve leaf copies.
  VisualInstance3D: {
    linterOnly: [
      // `layers` selects which Camera3D cull masks see the object. The previewer
      // renders through a single camera with no cull-mask support, so no parser
      // reads it — but it is a real serialised property worth format-checking.
      'layers',
    ],
    reason: 'Render layers are validated for format but unused: the previewer has one camera and no cull-mask filtering, so no parser reads them.',
  },

  Decal: {
    linterOnly: [
      // Godot serialises `sorting_offset` for a Decal (Decal::_validate_property
      // restores it from VisualInstance3D's PROPERTY_USAGE_NONE), so it is a
      // valid key worth format-checking — but it only biases draw ORDER among
      // transparent surfaces, which a static preview has no equivalent for.
      'sorting_offset',
    ],
    reason: 'sorting_offset is a real serialised Decal property, so the linter checks its format, but it only tunes transparency sort order and the renderer has nothing to do with it.',
  },

  MeshInstance3D: {
    parserOnly: [
      // Deprecated. `scene/3d/visual_instance_3d.cpp` binds `gi_lightmap_scale`
      // PROPERTY_USAGE_NONE and nothing restores it, so Godot never writes it to
      // a .tscn and its validator was deleted as dead. The parser still reads it
      // so an older hand-written scene carrying the key still loads.
      'gi_lightmap_scale',
    ],
    linterOnly: [
      // Wildcard slot validator (surface_material_override/N) registered as
      // a pattern; parser reads via a loop over Object.keys and is not
      // captured by the properties.X scrape pattern.
      'surface_material_override/*',
      // canvas_item.cpp's InstanceUniforms sibling for the 3D RS surface — see
      // the GeometryInstance3D entry, which this inherits.
      'instance_shader_parameters/*',
    ],
    renderGap: [
      // mesh_instance_3d.cpp:102-103: a per-blend-shape morph-target weight.
      // Godot genuinely redraws the mesh deformed by this weight; this
      // previewer implements no blend-shape/morph-target rendering at all,
      // so every MeshInstance3D with blend shapes renders its rest pose here
      // regardless of the authored weights.
      'blend_shapes/*',
    ],
    reason: 'MeshInstance3D linter uses a wildcard pattern for surface_material_override/N and instance_shader_parameters/N; the parser reads the former via an Object.keys loop not captured by the scrape and has no rendering surface for the latter at all. blend_shapes/<name> is a real, unimplemented morph-target rendering gap.',
  },

  // -------------------------------------------------------------------------
  // Lights (Light3D base level: shared validators + parseBaseLight* helpers,
  // both walked via the Light3D entries in NODE_BASE_TYPES and
  // BASE_TYPE_TO_PARSER_SUBPATH; base-level asymmetries live on Light3D above)
  // -------------------------------------------------------------------------

  DirectionalLight3D: {
    linterOnly: [
      // DirectionalLight3D linter registers additional shadow/sky properties
      // beyond what the parser reads for the preview.
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
