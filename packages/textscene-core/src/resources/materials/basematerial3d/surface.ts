/**
 * BaseMaterial3D's Transparency, Shading and Vertex Color groups
 * (`material.cpp:3586-3609`).
 *
 * Every enum setter here bare-assigns behind an equality early-return
 * (`set_blend_mode`, :2359, is the shape), so an out-of-range mode is stored as
 * written: hinted tier throughout.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

export const surfaceKeys: Record<string, PropertyValidator> = {
  transparency: v.enumInt(
    'transparency',
    0,
    4,
    {
      0: 'DISABLED',
      1: 'ALPHA',
      2: 'ALPHA_SCISSOR',
      3: 'ALPHA_HASH',
      4: 'ALPHA_DEPTH_PRE_PASS',
    },
    { hinted: 'material.cpp:3588' }
  ),
  // material.cpp:3589 ("0,1,0.001"), set_alpha_scissor_threshold (:2915) bare assigns.
  alpha_scissor_threshold: v.float('alpha_scissor_threshold', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3589',
  }),
  // material.cpp:3590 ("0,2,0.01"), set_alpha_hash_scale (:2924) bare assigns.
  alpha_hash_scale: v.float('alpha_hash_scale', { min: 0, max: 2, hinted: 'material.cpp:3590' }),
  alpha_antialiasing_mode: v.enumInt(
    'alpha_antialiasing_mode',
    0,
    2,
    {
      0: 'ALPHA_ANTIALIASING_OFF',
      1: 'ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE',
      2: 'ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE',
    },
    { hinted: 'material.cpp:3591' }
  ),
  // material.cpp:3592 ("0,1,0.01"), set_alpha_antialiasing_edge (:2933) bare assigns.
  alpha_antialiasing_edge: v.float('alpha_antialiasing_edge', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3592',
  }),
  blend_mode: v.enumInt(
    'blend_mode',
    0,
    4,
    { 0: 'MIX', 1: 'ADD', 2: 'SUB', 3: 'MUL', 4: 'PREMULT_ALPHA' },
    { hinted: 'material.cpp:3593' }
  ),
  cull_mode: v.enumInt(
    'cull_mode',
    0,
    2,
    { 0: 'BACK', 1: 'FRONT', 2: 'DISABLED' },
    { hinted: 'material.cpp:3594' }
  ),
  depth_draw_mode: v.enumInt(
    'depth_draw_mode',
    0,
    2,
    { 0: 'OPAQUE_ONLY', 1: 'ALWAYS', 2: 'DISABLED' },
    { hinted: 'material.cpp:3595' }
  ),
  // material.cpp:3596, one of the FLAG_* booleans routed through set_flag.
  no_depth_test: v.boolean('no_depth_test'),
  depth_test: v.enumInt(
    'depth_test',
    0,
    1,
    { 0: 'DEFAULT', 1: 'INVERTED' },
    { hinted: 'material.cpp:3597' }
  ),

  shading_mode: v.enumInt(
    'shading_mode',
    0,
    2,
    { 0: 'UNSHADED', 1: 'PER_PIXEL', 2: 'PER_VERTEX' },
    { hinted: 'material.cpp:3600' }
  ),
  diffuse_mode: v.enumInt(
    'diffuse_mode',
    0,
    3,
    { 0: 'BURLEY', 1: 'LAMBERT', 2: 'LAMBERT_WRAP', 3: 'TOON' },
    { hinted: 'material.cpp:3601' }
  ),
  specular_mode: v.enumInt(
    'specular_mode',
    0,
    2,
    { 0: 'SCHLICK_GGX', 1: 'TOON', 2: 'DISABLED' },
    { hinted: 'material.cpp:3602' }
  ),
  // material.cpp:3603-3605 and :3608-3609, all FLAG_* booleans.
  disable_ambient_light: v.boolean('disable_ambient_light'),
  disable_fog: v.boolean('disable_fog'),
  disable_specular_occlusion: v.boolean('disable_specular_occlusion'),
  vertex_color_use_as_albedo: v.boolean('vertex_color_use_as_albedo'),
  vertex_color_is_srgb: v.boolean('vertex_color_is_srgb'),
};
