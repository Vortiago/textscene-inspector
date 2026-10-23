/**
 * The fields Label3D and Sprite3D (SpriteBase3D) both store and hand to `get_material_for_2d`
 * (`material.cpp:3021`), with the defaults both constructors share.
 */

import { boolOr, enumOr, floatOr, intOr } from './valueParsers';
import type { EnumValue } from '../godot/classdb/enumNames';
import { AlphaAntiAliasing } from '../godot/rendering/materials/alphaAntialiasing';
import { AlphaCutMode } from '../godot/rendering/materials/alphaCut';
import { TextureFilter } from '../godot/rendering/materials/textureFilter';

const ALPHA_CUT_MODES = Object.values(AlphaCutMode);
const TEXTURE_FILTERS = Object.values(TextureFilter);

/**
 * The `get_material_for_2d` fields of a node of type `nodeType`, which names the node in a parse
 * warning. `set_alpha_antialiasing` stores any value (`label_3d.cpp:1058-1063`,
 * `sprite_3d.cpp:571-578`), and any but OFF ramps the edge. Both constructors leave `double_sided`
 * true and the other flags false (`sprite_3d.cpp:712-714`).
 */
export function parseMaterialFor2dFields(properties: Record<string, string>, nodeType: string) {
  // Each read names its key in the source, not through a table: the parity scan scrapes them.
  const label = (key: string) => `${nodeType} ${key}`;
  return {
    alpha_cut: enumOr(properties.alpha_cut, AlphaCutMode.DISABLED, ALPHA_CUT_MODES, label('alpha_cut')),
    alpha_scissor_threshold: floatOr(
      properties.alpha_scissor_threshold,
      0.5,
      label('alpha_scissor_threshold')
    ),
    alpha_hash_scale: floatOr(properties.alpha_hash_scale, 1, label('alpha_hash_scale')),
    alpha_antialiasing_mode: intOr(
      properties.alpha_antialiasing_mode,
      AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF,
      label('alpha_antialiasing_mode')
    ) as EnumValue<typeof AlphaAntiAliasing>,
    alpha_antialiasing_edge: floatOr(properties.alpha_antialiasing_edge, 0, label('alpha_antialiasing_edge')),
    texture_filter: enumOr(
      properties.texture_filter,
      TextureFilter.LINEAR_WITH_MIPMAPS,
      TEXTURE_FILTERS,
      label('texture_filter')
    ),
    no_depth_test: boolOr(properties.no_depth_test, false, label('no_depth_test')),
    double_sided: boolOr(properties.double_sided, true, label('double_sided')),
    fixed_size: boolOr(properties.fixed_size, false, label('fixed_size')),
  };
}
