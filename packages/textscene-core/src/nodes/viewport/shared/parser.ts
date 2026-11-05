/**
 * The keys every Viewport class serialises, `Viewport::_bind_methods` (`viewport.cpp`), with Godot's
 * defaults from `doc/classes/Viewport.xml`. SubViewport and Window each add their own.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseAnisotropicFilteringLevel } from '../../../parser/projectSettingsParser';
import { boolOr, enumOr, parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import { parseNode } from '../../node/parser';
import { MSAA_DISABLED, MSAA_MODES } from '../../../godot/rendering/msaa';
import {
  VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER,
  VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT,
  VIEWPORT_TEXTURE_FILTERS,
  VIEWPORT_TEXTURE_REPEATS,
} from '../../../godot/scene/viewport';
import type { ViewportProperties } from './types';

export function parseViewport(
  heading: ParsedHeading,
  properties: Record<string, string>
): ViewportProperties {
  // `transform` is discarded: a Viewport is not a spatial node, so Godot never
  // writes one, and carrying the base parser's field would let a malformed scene
  // put a transform on something that cannot have one.
  const { transform: _transform, ...baseProperties } = parseNode(heading, properties);
  const context = `${heading.attributes.type ?? 'Viewport'} ${baseProperties.name || '(unnamed)'}`;

  return {
    ...baseProperties,
    own_world_3d: boolOr(properties.own_world_3d, false, context),
    disable_3d: boolOr(properties.disable_3d, false, context),
    transparent_bg: boolOr(properties.transparent_bg, false, context),
    handle_input_locally: boolOr(properties.handle_input_locally, true, context),
    msaa_2d: enumOr(properties.msaa_2d, MSAA_DISABLED, MSAA_MODES, context),
    msaa_3d: enumOr(properties.msaa_3d, MSAA_DISABLED, MSAA_MODES, context),
    use_debanding: boolOr(properties.use_debanding, false, context),
    audio_listener_enable_2d: boolOr(properties.audio_listener_enable_2d, false, context),
    canvas_item_default_texture_filter: enumOr(
      properties.canvas_item_default_texture_filter,
      VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER,
      VIEWPORT_TEXTURE_FILTERS,
      context
    ),
    canvas_item_default_texture_repeat: enumOr(
      properties.canvas_item_default_texture_repeat,
      VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT,
      VIEWPORT_TEXTURE_REPEATS,
      context
    ),
    gui_embed_subwindows: boolOr(properties.gui_embed_subwindows, false, context),
    texture_mipmap_bias: parseOptionalFloat(properties.texture_mipmap_bias),
    anisotropic_filtering_level: parseAnisotropicFilteringLevel(properties.anisotropic_filtering_level),
    positional_shadow_atlas_size: parseOptionalInt(properties.positional_shadow_atlas_size),
    positional_shadow_atlas_quad_0: parseOptionalInt(properties.positional_shadow_atlas_quad_0),
    positional_shadow_atlas_quad_1: parseOptionalInt(properties.positional_shadow_atlas_quad_1),
    positional_shadow_atlas_quad_2: parseOptionalInt(properties.positional_shadow_atlas_quad_2),
    positional_shadow_atlas_quad_3: parseOptionalInt(properties.positional_shadow_atlas_quad_3),
  };
}
