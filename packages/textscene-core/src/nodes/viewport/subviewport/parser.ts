/**
 * SubViewport parser — extends the Node base parse.
 *
 * Every default here is Godot's, read from `doc/classes/SubViewport.xml` and
 * `Viewport.xml` rather than inferred: unset properties dominate this corpus, so
 * a wrong default is a rendering bug no fixture would reveal.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, enumOr, vec2iOr } from '../../../parser/valueParsers';
import { parseNode } from '../../node/parser';
import {
  CLEAR_MODE_ALWAYS,
  CLEAR_MODE_NEVER,
  CLEAR_MODE_ONCE,
  UPDATE_MODE_ALWAYS,
  UPDATE_MODE_DISABLED,
  UPDATE_MODE_ONCE,
  UPDATE_MODE_WHEN_PARENT_VISIBLE,
  UPDATE_MODE_WHEN_VISIBLE,
  type SubViewportProperties,
} from './types';

const UPDATE_MODES = [
  UPDATE_MODE_DISABLED,
  UPDATE_MODE_ONCE,
  UPDATE_MODE_WHEN_VISIBLE,
  UPDATE_MODE_WHEN_PARENT_VISIBLE,
  UPDATE_MODE_ALWAYS,
] as const;

const CLEAR_MODES = [CLEAR_MODE_ALWAYS, CLEAR_MODE_NEVER, CLEAR_MODE_ONCE] as const;

/** `Viewport.MSAA` — DISABLED, 2X, 4X, 8X. */
const MSAA_MODES = [0, 1, 2, 3] as const;

/** `Viewport.DefaultCanvasItemTextureFilter` — NEAREST, LINEAR, + mipmap variants. */
const TEXTURE_FILTERS = [0, 1, 2, 3] as const;

export function parseSubViewport(
  heading: ParsedHeading,
  properties: Record<string, string>
): SubViewportProperties {
  const baseProperties = parseNode(heading, properties);
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
      UPDATE_MODE_WHEN_VISIBLE,
      UPDATE_MODES,
      context
    ),
    render_target_clear_mode: enumOr(
      properties.render_target_clear_mode,
      CLEAR_MODE_ALWAYS,
      CLEAR_MODES,
      context
    ),
    msaa_3d: enumOr(properties.msaa_3d, 0, MSAA_MODES, context),
    use_debanding: boolOr(properties.use_debanding, false, context),
    audio_listener_enable_2d: boolOr(properties.audio_listener_enable_2d, false, context),
    canvas_item_default_texture_filter: enumOr(
      properties.canvas_item_default_texture_filter,
      1,
      TEXTURE_FILTERS,
      context
    ),
    gui_embed_subwindows: boolOr(properties.gui_embed_subwindows, false, context),
  };
}
