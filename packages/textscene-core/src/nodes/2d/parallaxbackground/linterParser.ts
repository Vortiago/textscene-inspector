/**
 * ParallaxBackground strict validators. The placement half is CanvasLayer's, not
 * Node2D's: `transform` is a Transform2D, and no `position`, `z_index` or
 * `modulate` exists.
 */

// Registration happens on import, so a test that loads only this slice
// resolves an inherited key only when this line imports the ancestor.
import '../ui/canvaslayer/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// The eight CanvasLayer keys come from the base, which grounds `layer` on
// RS::CANVAS_LAYER_MIN/MAX rather than accepting whatever parseInt tolerates.
validatorRegistry.registerAll('ParallaxBackground', {
  scroll_offset: v.vector2('scroll_offset'),
  scroll_base_offset: v.vector2('scroll_base_offset'),
  scroll_base_scale: v.vector2('scroll_base_scale'),
  scroll_limit_begin: v.vector2('scroll_limit_begin'),
  scroll_limit_end: v.vector2('scroll_limit_end'),
  scroll_ignore_camera_zoom: v.boolean('scroll_ignore_camera_zoom'),
});
