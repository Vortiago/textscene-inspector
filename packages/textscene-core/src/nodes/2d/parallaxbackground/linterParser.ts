/**
 * ParallaxBackground strict validators.
 *
 * The placement half is CanvasLayer's, not Node2D's — `transform` here is a
 * **Transform2D**, and there is no `position`, `z_index` or `modulate` to check.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../ui/canvaslayer/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// The eight CanvasLayer keys this used to re-declare now come from the base,
// which grounds `layer` on RS::CANVAS_LAYER_MIN/MAX instead of accepting
// whatever parseInt tolerated.
validatorRegistry.registerAll('ParallaxBackground', {
  scroll_offset: v.vector2('scroll_offset'),
  scroll_base_offset: v.vector2('scroll_base_offset'),
  scroll_base_scale: v.vector2('scroll_base_scale'),
  scroll_limit_begin: v.vector2('scroll_limit_begin'),
  scroll_limit_end: v.vector2('scroll_limit_end'),
  scroll_ignore_camera_zoom: v.boolean('scroll_ignore_camera_zoom'),
});
