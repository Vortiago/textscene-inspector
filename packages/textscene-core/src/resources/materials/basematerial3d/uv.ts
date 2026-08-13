/**
 * BaseMaterial3D's UV1, UV2, Sampling and Shadows groups
 * (`material.cpp:3717-3737`).
 *
 * The two triplanar sharpnesses are the only bound, and it is the setter's:
 * EXP_EASING states no range while `set_uv1_triplanar_blend_sharpness` stores
 * `CLAMP(p_sharpness, 0.0, 150.0)` (:2786, and :2814 for UV2).
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

export const uvKeys: Record<string, PropertyValidator> = {
  // A zero component is legal grammar but a degenerate scale; catching it needs
  // a lint rule, since a property validator can only return errors.
  uv1_scale: v.vector3('uv1_scale'),
  uv1_offset: v.vector3('uv1_offset'),
  uv1_triplanar: v.boolean('uv1_triplanar'),
  uv1_triplanar_sharpness: v.float('uv1_triplanar_sharpness', {
    min: 0,
    max: 150,
    enforced: 'material.cpp:2786',
  }),
  uv1_world_triplanar: v.boolean('uv1_world_triplanar'),

  uv2_scale: v.vector3('uv2_scale'),
  uv2_offset: v.vector3('uv2_offset'),
  uv2_triplanar: v.boolean('uv2_triplanar'),
  uv2_triplanar_sharpness: v.float('uv2_triplanar_sharpness', {
    min: 0,
    max: 150,
    enforced: 'material.cpp:2814',
  }),
  uv2_world_triplanar: v.boolean('uv2_world_triplanar'),

  // material.cpp:3732, set_texture_filter (:2567-2570) is a bare assignment.
  texture_filter: v.enumInt(
    'texture_filter',
    0,
    5,
    {
      0: 'NEAREST',
      1: 'LINEAR',
      2: 'NEAREST_WITH_MIPMAPS',
      3: 'LINEAR_WITH_MIPMAPS',
      4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
      5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
    },
    { hinted: 'material.cpp:3732' }
  ),
  // material.cpp:3733 and :3736-3737, FLAG_* booleans.
  texture_repeat: v.boolean('texture_repeat'),
  disable_receive_shadows: v.boolean('disable_receive_shadows'),
  shadow_to_opacity: v.boolean('shadow_to_opacity'),
};
