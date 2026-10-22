/**
 * BaseMaterial3D's Transparency, Shading and Vertex Color groups (`material.cpp:3586-3609`).
 * Every enum setter bare-assigns behind an equality early-return (`set_blend_mode`,
 * :2359), so an out-of-range mode is stored as written: hinted tier throughout.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { ALPHA_ANTIALIASING_NAMES } from '../../../godot/rendering/materials/alphaAntialiasing.js';
import { BASE_MATERIAL_3D_BLEND_MODE_NAMES } from '../../../godot/rendering/materials/blendMode.js';
import { CULL_MODE_NAMES } from '../../../godot/rendering/materials/cullMode.js';
import { DEPTH_DRAW_MODE_NAMES } from '../../../godot/rendering/materials/depthDrawMode.js';
import { DEPTH_TEST_NAMES } from '../../../godot/rendering/materials/depthTest.js';
import { SHADING_MODE_NAMES } from '../../../godot/rendering/materials/shadingMode.js';
import { TRANSPARENCY_NAMES } from '../../../godot/rendering/materials/transparency.js';
import { DIFFUSE_MODE_NAMES } from '../../../godot/rendering/materials/diffuseMode.js';
import { SPECULAR_MODE_NAMES } from '../../../godot/rendering/materials/specularMode.js';

export const surfaceKeys: Record<string, PropertyValidator> = {
  transparency: v.enumInt('transparency', TRANSPARENCY_NAMES, { hinted: 'material.cpp:3588' }),
  // material.cpp:3589 ("0,1,0.001"), set_alpha_scissor_threshold (:2915) bare assigns.
  alpha_scissor_threshold: v.float('alpha_scissor_threshold', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3589',
  }),
  // material.cpp:3590 ("0,2,0.01"), set_alpha_hash_scale (:2924) bare assigns.
  alpha_hash_scale: v.float('alpha_hash_scale', { min: 0, max: 2, hinted: 'material.cpp:3590' }),
  alpha_antialiasing_mode: v.enumInt('alpha_antialiasing_mode', ALPHA_ANTIALIASING_NAMES, {
    hinted: 'material.cpp:3591',
  }),
  // material.cpp:3592 ("0,1,0.01"), set_alpha_antialiasing_edge (:2933) bare assigns.
  alpha_antialiasing_edge: v.float('alpha_antialiasing_edge', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3592',
  }),
  blend_mode: v.enumInt('blend_mode', BASE_MATERIAL_3D_BLEND_MODE_NAMES, {
    hinted: 'material.cpp:3593',
  }),
  cull_mode: v.enumInt('cull_mode', CULL_MODE_NAMES, {
    hinted: 'material.cpp:3594',
  }),
  depth_draw_mode: v.enumInt('depth_draw_mode', DEPTH_DRAW_MODE_NAMES, { hinted: 'material.cpp:3595' }),
  // material.cpp:3596, one of the FLAG_* booleans routed through set_flag.
  no_depth_test: v.boolean('no_depth_test'),
  depth_test: v.enumInt('depth_test', DEPTH_TEST_NAMES, {
    hinted: 'material.cpp:3597',
  }),

  shading_mode: v.enumInt('shading_mode', SHADING_MODE_NAMES, {
    hinted: 'material.cpp:3600',
  }),
  diffuse_mode: v.enumInt('diffuse_mode', DIFFUSE_MODE_NAMES, { hinted: 'material.cpp:3601' }),
  specular_mode: v.enumInt('specular_mode', SPECULAR_MODE_NAMES, { hinted: 'material.cpp:3602' }),
  // material.cpp:3603-3605 and :3608-3609, all FLAG_* booleans.
  disable_ambient_light: v.boolean('disable_ambient_light'),
  disable_fog: v.boolean('disable_fog'),
  disable_specular_occlusion: v.boolean('disable_specular_occlusion'),
  vertex_color_use_as_albedo: v.boolean('vertex_color_use_as_albedo'),
  vertex_color_is_srgb: v.boolean('vertex_color_is_srgb'),
};
