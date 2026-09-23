/**
 * Parallax2D strict validators, for the members doc/classes/Parallax2D.xml lists
 * without `overrides=`. parallax_2d.cpp:288-303 is the only property site:
 * parallax_2d.h has no PropertyListHelper, ADD_ARRAY_COUNT or `_set`/`_get` override.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/**
 * The setter clamps a negative component up to 0 (`p_repeat_size.maxf(0)`,
 * parallax_2d.cpp:165, per component by core/math/vector2.h:106): an enforced
 * floor. parallax_2d.cpp:292 carries no hint, so no second, hinted bound exists.
 */
const repeatSizeValidator = v.vector2('repeat_size', {
  // `nan` passes, as in every MAX()-clamp validator (FogVolume.size, Decal's
  // fade pair), though the setter's MAX(nan, 0) stores 0.
  components: (parts) =>
    parts.some((component) => component < 0)
      ? { message: `Property 'repeat_size' components must be >= 0; Godot's setter clamps a negative component up to 0 (parallax_2d.cpp:165), got: Vector2(${parts.join(', ')})` }
      : null,
  accepts: 'Vector2(x, y), each >= 0',
  enforced: 'parallax_2d.cpp:165',
});

// `_validate_property` (parallax_2d.cpp:78-82) only hides the inherited Node2D
// `position` behind PROPERTY_USAGE_NONE. It adds no key.
validatorRegistry.registerAll('Parallax2D', {
  // parallax_2d.cpp:288, PROPERTY_HINT_LINK is a bare UI link-toggle hint
  // (core/object/object.h:56), not a range. set_scroll_scale (:152-154)
  // assigns straight through, so there is nothing to bound.
  scroll_scale: v.vector2('scroll_scale'),
  // parallax_2d.cpp:289, PROPERTY_HINT_NONE. set_scroll_offset (:190-196)
  // assigns straight through.
  scroll_offset: v.vector2('scroll_offset'),
  repeat_size: repeatSizeValidator,
  // parallax_2d.cpp:293, PROPERTY_HINT_NONE. set_autoscroll (:204-211) assigns
  // straight through.
  autoscroll: v.vector2('autoscroll'),
  // parallax_2d.cpp:294, a bare Variant::INT with no hint. set_repeat_times
  // (:176-183) clamps anything below 1 up to 1 (`MAX(p_repeat_times, 1)`): an
  // enforced floor, error tier per ADR-0032.
  repeat_times: v.strictInt('repeat_times', { min: 1, enforced: 'parallax_2d.cpp:181' }),
  // parallax_2d.cpp:297, PROPERTY_HINT_NONE. set_limit_begin (:233-235) assigns
  // straight through.
  // No cross-field rule: `_update_scroll` (parallax_2d.cpp:108-116) skips an
  // axis's clamp when `limit_begin > limit_end - viewport_size`, without complaint.
  limit_begin: v.vector2('limit_begin'),
  // parallax_2d.cpp:298, PROPERTY_HINT_NONE. set_limit_end (:241-243) assigns
  // straight through.
  limit_end: v.vector2('limit_end'),
  // parallax_2d.cpp:301. set_follow_viewport (:249-251) assigns straight
  // through.
  follow_viewport: v.boolean('follow_viewport'),
  // parallax_2d.cpp:302. set_ignore_camera_scroll (:257-259) assigns straight
  // through.
  ignore_camera_scroll: v.boolean('ignore_camera_scroll'),
  // parallax_2d.cpp:303, PROPERTY_HINT_NONE. set_screen_offset (:219-225)
  // assigns straight through.
  screen_offset: v.vector2('screen_offset'),
});
