/**
 * SubViewport parser: extends the Node base parse. Every default is Godot's, from
 * `doc/classes/SubViewport.xml` and `Viewport.xml`, since a wrong default is a
 * rendering bug no fixture reveals.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, enumOr, parseOptionalInt, vec2iOr } from '../../../parser/valueParsers';
import { parseNode } from '../../node/parser';
import { enumValues } from '../../../godot/classdb/enumNames';
import { MSAA_DISABLED, MSAA_MODES } from '../../../godot/rendering/msaa';
import {
  VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER,
  DefaultCanvasItemTextureFilter,
  DefaultCanvasItemTextureRepeat,
  SubViewportClearMode,
  SubViewportUpdateMode,
} from '../../../godot/scene/viewport';
import type { SubViewportProperties } from './types';

const UPDATE_MODES = enumValues(SubViewportUpdateMode);
const CLEAR_MODES = enumValues(SubViewportClearMode);

/** `Viewport.DefaultCanvasItemTextureFilter`: NEAREST, LINEAR and the mipmap variants. */
const TEXTURE_FILTERS = [
  DefaultCanvasItemTextureFilter.NEAREST,
  DefaultCanvasItemTextureFilter.LINEAR,
  DefaultCanvasItemTextureFilter.LINEAR_WITH_MIPMAPS,
  DefaultCanvasItemTextureFilter.NEAREST_WITH_MIPMAPS,
] as const;

/** `Viewport.DefaultCanvasItemTextureRepeat`: the three modes 4.6.3 accepts, without 4.7's PARENT_NODE. */
const TEXTURE_REPEATS = [
  DefaultCanvasItemTextureRepeat.DISABLED,
  DefaultCanvasItemTextureRepeat.ENABLED,
  DefaultCanvasItemTextureRepeat.MIRROR,
] as const;

export function parseSubViewport(
  heading: ParsedHeading,
  properties: Record<string, string>
): SubViewportProperties {
  // `transform` is discarded: a Viewport is not a spatial node, so Godot never
  // writes one, and carrying the base parser's field would let a malformed scene
  // put a transform on something that cannot have one.
  const { transform: _transform, ...baseProperties } = parseNode(heading, properties);
  const context = `SubViewport ${baseProperties.name || '(unnamed)'}`;

  return {
    ...baseProperties,
    size: vec2iOr(properties.size, { x: 512, y: 512 }, context),
    size_2d_override: vec2iOr(properties.size_2d_override, { x: 0, y: 0 }, context),
    size_2d_override_stretch: boolOr(properties.size_2d_override_stretch, false, context),
    own_world_3d: boolOr(properties.own_world_3d, false, context),
    disable_3d: boolOr(properties.disable_3d, false, context),
    transparent_bg: boolOr(properties.transparent_bg, false, context),
    handle_input_locally: boolOr(properties.handle_input_locally, true, context),
    render_target_update_mode: enumOr(
      properties.render_target_update_mode,
      SubViewportUpdateMode.WHEN_VISIBLE,
      UPDATE_MODES,
      context
    ),
    render_target_clear_mode: enumOr(
      properties.render_target_clear_mode,
      SubViewportClearMode.ALWAYS,
      CLEAR_MODES,
      context
    ),
    msaa_2d: enumOr(properties.msaa_2d, MSAA_DISABLED, MSAA_MODES, context),
    msaa_3d: enumOr(properties.msaa_3d, MSAA_DISABLED, MSAA_MODES, context),
    use_debanding: boolOr(properties.use_debanding, false, context),
    audio_listener_enable_2d: boolOr(properties.audio_listener_enable_2d, false, context),
    canvas_item_default_texture_filter: enumOr(
      properties.canvas_item_default_texture_filter,
      VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER,
      TEXTURE_FILTERS,
      context
    ),
    canvas_item_default_texture_repeat: enumOr(
      properties.canvas_item_default_texture_repeat,
      DefaultCanvasItemTextureRepeat.DISABLED,
      TEXTURE_REPEATS,
      context
    ),
    gui_embed_subwindows: boolOr(properties.gui_embed_subwindows, false, context),
    positional_shadow_atlas_size: parseOptionalInt(properties.positional_shadow_atlas_size),
    positional_shadow_atlas_quad_0: parseOptionalInt(properties.positional_shadow_atlas_quad_0),
    positional_shadow_atlas_quad_1: parseOptionalInt(properties.positional_shadow_atlas_quad_1),
    positional_shadow_atlas_quad_2: parseOptionalInt(properties.positional_shadow_atlas_quad_2),
    positional_shadow_atlas_quad_3: parseOptionalInt(properties.positional_shadow_atlas_quad_3),
  };
}
