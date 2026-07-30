/**
 * SubViewport strict validators — pure format checks, so every failure is an
 * error (CONTEXT.md's sorting principle). Enum bounds come from
 * `doc/classes/SubViewport.xml` / `Viewport.xml`.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const UPDATE_MODE = {
  0: 'DISABLED',
  1: 'ONCE',
  2: 'WHEN_VISIBLE',
  3: 'WHEN_PARENT_VISIBLE',
  4: 'ALWAYS',
};

const CLEAR_MODE = { 0: 'ALWAYS', 1: 'NEVER', 2: 'ONCE' };

const MSAA = { 0: 'DISABLED', 1: '2X', 2: '4X', 3: '8X' };

// Only properties the parser actually reads are validated — the propertyGrammarParity
// guard keeps the two sides symmetric, so a validator without a parser read is a desync.

const TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'NEAREST_WITH_MIPMAPS',
  3: 'LINEAR_WITH_MIPMAPS',
};

validatorRegistry.registerAll('SubViewport', {
  // Non-negative: a negative render target is meaningless, and Godot's own
  // setter clamps. The zero case is advisory, so it lives in linter.ts.
  size: v.vector2i('size', true),
  size_2d_override: v.vector2i('size_2d_override'),
  size_2d_override_stretch: v.boolean('size_2d_override_stretch'),
  own_world_3d: v.boolean('own_world_3d'),
  disable_3d: v.boolean('disable_3d'),
  transparent_bg: v.boolean('transparent_bg'),
  handle_input_locally: v.boolean('handle_input_locally'),
  use_debanding: v.boolean('use_debanding'),
  audio_listener_enable_2d: v.boolean('audio_listener_enable_2d'),
  gui_embed_subwindows: v.boolean('gui_embed_subwindows'),
  render_target_update_mode: v.enumInt('render_target_update_mode', 0, 4, UPDATE_MODE),
  render_target_clear_mode: v.enumInt('render_target_clear_mode', 0, 2, CLEAR_MODE),
  msaa_3d: v.enumInt('msaa_3d', 0, 3, MSAA),
  canvas_item_default_texture_filter: v.enumInt(
    'canvas_item_default_texture_filter',
    0,
    3,
    TEXTURE_FILTER
  ),
});
