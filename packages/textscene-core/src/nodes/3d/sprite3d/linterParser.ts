/**
 * Sprite3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// PARTICLES is absent: Godot rejects it on a sprite (scene/3d/sprite_3d.cpp:598).
const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };
const ALPHA_CUT = { 0: 'DISABLED', 1: 'DISCARD', 2: 'OPAQUE_PREPASS', 3: 'HASH' };
const AXIS = { 0: 'X_AXIS', 1: 'Y_AXIS', 2: 'Z_AXIS' };
// BaseMaterial3D::TextureFilter, TEXTURE_FILTER_MAX = 6 (scene/resources/material.h:172-178).
const TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'NEAREST_WITH_MIPMAPS',
  3: 'LINEAR_WITH_MIPMAPS',
  4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
};
// BaseMaterial3D::AlphaAntiAliasing, ALPHA_ANTIALIASING_MAX = 3 (material.h:197-200).
const ALPHA_ANTIALIASING = { 0: 'OFF', 1: 'ALPHA_TO_COVERAGE', 2: 'ALPHA_TO_COVERAGE_AND_TO_ONE' };

validatorRegistry.registerAll('Sprite3D', {
  texture: v.resourceReference('texture'),
  billboard: v.enumInt('billboard', 0, 2, BILLBOARD),
  alpha_cut: v.enumInt('alpha_cut', 0, 3, ALPHA_CUT),
  axis: v.enumInt('axis', 0, 2, AXIS),
  pixel_size: v.positiveFloat('pixel_size'),
  transparency: v.float('transparency', { min: 0, max: 1 }),
  hframes: v.positiveInt('hframes'),
  vframes: v.positiveInt('vframes'),
  frame: v.int('frame', { min: 0 }),
  offset: v.vector2('offset'),
  frame_coords: v.vector2i('frame_coords'),
  region_rect: v.rect2('region_rect'),
  modulate: v.color('modulate'),
  render_priority: v.int('render_priority'),
  // Variant::BOOL in Godot (scene/3d/sprite_3d.cpp:677-688, :1019).
  centered: v.boolean('centered'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  region_enabled: v.boolean('region_enabled'),
  double_sided: v.boolean('double_sided'),
  transparent: v.boolean('transparent'),
  // Draw flags, all Variant::BOOL (scene/3d/sprite_3d.cpp:687-690).
  shaded: v.boolean('shaded'),
  no_depth_test: v.boolean('no_depth_test'),
  fixed_size: v.boolean('fixed_size'),
  texture_filter: v.enumInt('texture_filter', 0, 5, TEXTURE_FILTER),
  alpha_antialiasing_mode: v.enumInt('alpha_antialiasing_mode', 0, 2, ALPHA_ANTIALIASING),
  // Unbounded: the setters assign without clamping (sprite_3d.cpp:545,558,584),
  // so the editor's hint range is not a validity rule.
  alpha_scissor_threshold: v.float('alpha_scissor_threshold'),
  alpha_hash_scale: v.float('alpha_hash_scale'),
  alpha_antialiasing_edge: v.float('alpha_antialiasing_edge'),
});
