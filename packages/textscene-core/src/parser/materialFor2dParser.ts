/**
 * The fields Label3D and Sprite3D (SpriteBase3D) both store and hand to `get_material_for_2d`
 * (`material.cpp:3021`), with the defaults both constructors share.
 */

import { boolOr, enumOr, floatOr, intOr } from './valueParsers';
import type { EnumValue } from '../godot/classdb/enumNames';
import { AlphaAntiAliasing } from '../godot/rendering/materials/alphaAntialiasing';
import { AlphaCutMode } from '../godot/rendering/materials/alphaCut';
import { TextureFilter } from '../godot/rendering/materials/textureFilter';

/** The `get_material_for_2d` fields a Label3D or Sprite3D stores (`label_3d.h:61-65`, `sprite_3d.h:89-94`). */
export interface MaterialFor2dFields {
  /** Transparency mode (default DISABLED). */
  alpha_cut: EnumValue<typeof AlphaCutMode>;
  /** Scissor cut used by `alpha_cut` DISCARD (default 0.5). */
  alpha_scissor_threshold: number;
  /** Grain of the `alpha_cut` HASH dither (default 1.0). */
  alpha_hash_scale: number;
  /** Alpha antialiasing of a DISCARD or HASH cut (default OFF). */
  alpha_antialiasing_mode: EnumValue<typeof AlphaAntiAliasing>;
  /** Where the antialiased cut's edge sits (default 0). */
  alpha_antialiasing_edge: number;
  /** Sampler filter for the texture (default LINEAR_WITH_MIPMAPS). */
  texture_filter: EnumValue<typeof TextureFilter>;
  /** `FLAG_DISABLE_DEPTH_TEST` → `render_mode depth_test_disabled` (`material.cpp:863`, default false). */
  no_depth_test: boolean;
  /** Visible from behind (default true → THREE.DoubleSide). */
  double_sided: boolean;
  /** `FLAG_FIXED_SIZE`: a depth-proportional rescale in the vertex shader (`material.cpp:1357`, default false). */
  fixed_size: boolean;
  /** `FLAG_SHADED`: lit by the scene's 3D lights, `SHADING_MODE_PER_PIXEL` (`material.cpp:3045`, default false). */
  shaded: boolean;
}

const ALPHA_CUT_MODES = Object.values(AlphaCutMode);
const TEXTURE_FILTERS = Object.values(TextureFilter);

/**
 * The `get_material_for_2d` fields of a node of type `nodeType`, which names the node in a parse
 * warning. `set_alpha_antialiasing` stores any value (`label_3d.cpp:1058-1063`,
 * `sprite_3d.cpp:571-578`), and any but OFF ramps the edge. Both constructors leave `double_sided`
 * true and the other flags false (`sprite_3d.cpp:712-714`).
 */
export function parseMaterialFor2dFields(
  properties: Record<string, string>,
  nodeType: string
): MaterialFor2dFields {
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
    shaded: boolOr(properties.shaded, false, label('shaded')),
  };
}
