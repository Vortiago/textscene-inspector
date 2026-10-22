/**
 * The fields Label3D and Sprite3D (SpriteBase3D) both store and hand to `get_material_for_2d`
 * (`material.cpp:3021`), with the defaults both constructors share.
 */

import { boolOr, enumOr, floatOr, intOr } from './valueParsers';
import { AlphaCutMode } from '../godot/rendering/materials/alphaCut';
import { TextureFilter } from '../godot/rendering/materials/textureFilter';

const ALPHA_CUT_MODES = [
  AlphaCutMode.DISABLED,
  AlphaCutMode.DISCARD,
  AlphaCutMode.OPAQUE_PREPASS,
  AlphaCutMode.HASH,
];

const TEXTURE_FILTERS = [
  TextureFilter.NEAREST,
  TextureFilter.LINEAR,
  TextureFilter.NEAREST_WITH_MIPMAPS,
  TextureFilter.LINEAR_WITH_MIPMAPS,
  TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC,
  TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC,
];

/**
 * The `get_material_for_2d` fields of a node of type `nodeType`, which names the node in a parse
 * warning. `set_alpha_antialiasing` stores any value (`label_3d.cpp:1058-1063`,
 * `sprite_3d.cpp:571-578`), and any but OFF ramps the edge. Both constructors leave `double_sided`
 * true and the other flags false (`sprite_3d.cpp:712-714`).
 */
export function parseMaterialFor2dFields(properties: Record<string, string>, nodeType: string) {
  return {
    alpha_cut: enumOr(properties.alpha_cut, AlphaCutMode.DISABLED, ALPHA_CUT_MODES, `${nodeType} alpha_cut`),
    alpha_scissor_threshold: floatOr(
      properties.alpha_scissor_threshold,
      0.5,
      `${nodeType} alpha_scissor_threshold`
    ),
    alpha_hash_scale: floatOr(properties.alpha_hash_scale, 1, `${nodeType} alpha_hash_scale`),
    alpha_antialiasing_mode: intOr(
      properties.alpha_antialiasing_mode,
      0,
      `${nodeType} alpha_antialiasing_mode`
    ),
    alpha_antialiasing_edge: floatOr(
      properties.alpha_antialiasing_edge,
      0,
      `${nodeType} alpha_antialiasing_edge`
    ),
    texture_filter: enumOr(
      properties.texture_filter,
      TextureFilter.LINEAR_WITH_MIPMAPS,
      TEXTURE_FILTERS,
      `${nodeType} texture_filter`
    ),
    no_depth_test: boolOr(properties.no_depth_test, false, `${nodeType} no_depth_test`),
    double_sided: boolOr(properties.double_sided, true, `${nodeType} double_sided`),
    fixed_size: boolOr(properties.fixed_size, false, `${nodeType} fixed_size`),
  };
}
