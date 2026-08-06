/**
 * ParallaxBackground strict validators.
 *
 * The placement half is CanvasLayer's, not Node2D's — `transform` here is a
 * **Transform2D**, and there is no `position`, `z_index` or `modulate` to check.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('ParallaxBackground', {
  visible: v.boolean('visible'),
  layer: v.lenientInt('layer'),
  offset: v.vector2('offset'),
  rotation: v.float('rotation'),
  scale: v.vector2('scale'),
  transform: v.transform2d('transform'),
  follow_viewport_enabled: v.boolean('follow_viewport_enabled'),
  follow_viewport_scale: v.float('follow_viewport_scale'),
  scroll_offset: v.vector2('scroll_offset'),
  scroll_base_offset: v.vector2('scroll_base_offset'),
  scroll_base_scale: v.vector2('scroll_base_scale'),
  scroll_limit_begin: v.vector2('scroll_limit_begin'),
  scroll_limit_end: v.vector2('scroll_limit_end'),
  scroll_ignore_camera_zoom: v.boolean('scroll_ignore_camera_zoom'),
});
