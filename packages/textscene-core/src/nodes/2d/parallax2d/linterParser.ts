/**
 * Parallax2D strict validators for linting.
 *
 * Declare only Parallax2D's OWN members — the ones doc/classes/Parallax2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * parallax_2d.cpp:288-303 (`Parallax2D::_bind_methods`) is the only
 * ADD_PROPERTY site; parallax_2d.h declares no PropertyListHelper,
 * ADD_ARRAY_COUNT, or hand-rolled `_set`/`_get`/property-list override. The
 * one `_validate_property` (parallax_2d.cpp:78-82) only hides the inherited
 * Node2D `position` behind PROPERTY_USAGE_NONE — it adds no key.
 * `physics_interpolation_mode` carries `overrides="Node"` in the XML, so it is
 * a default-value override rather than a new property, and is skipped.
 *
 * No cross-field rule for `limit_begin`/`limit_end`: `_update_scroll`
 * (parallax_2d.cpp:108-116) only applies the clamp per axis when
 * `limit_begin <= limit_end - viewport_size`, and silently skips that axis's
 * clamp otherwise. An inverted pair produces an empty, unapplied range with no
 * complaint from the engine, so a warning here would be speculative.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/**
 * `repeat_size`'s floor is enforced: the setter clamps a negative component up
 * to 0 (`repeat_size = p_repeat_size.maxf(0);`, parallax_2d.cpp:165 —
 * Vector2::maxf is a per-component MAX against the scalar,
 * core/math/vector2.h:106). Unlike FogVolume.size there is no accompanying
 * PROPERTY_HINT_RANGE (parallax_2d.cpp:292 carries no hint at all), so there is
 * only the one enforced threshold, not a second hinted one.
 *
 * A `nan` component is accepted silently: `nan < 0` is false, so the value
 * branch never fires here — even though `MAX(nan, 0)` in the setter itself
 * actually resolves to `0` (`(a > b) ? a : b` with `nan > 0` false), the same
 * silent alteration a negative value gets. Every other MAX()-clamp validator
 * in this codebase (FogVolume.size, Decal's fade pair) accepts `nan` the same
 * way, so this stays consistent with them rather than becoming the one
 * validator that treats a `nan` component as a value error.
 */
const repeatSizeValidator = v.vector2('repeat_size', {
  components: (parts) =>
    parts.some((component) => component < 0)
      ? { message: `Property 'repeat_size' components must be >= 0; Godot's setter clamps a negative component up to 0 (parallax_2d.cpp:165), got: Vector2(${parts.join(', ')})` }
      : null,
  accepts: 'Vector2(x, y), each >= 0',
  enforced: 'parallax_2d.cpp:165',
});

validatorRegistry.registerAll('Parallax2D', {
  // parallax_2d.cpp:288, PROPERTY_HINT_LINK — a bare UI link-toggle hint
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
  // (:176-183) clamps anything below 1 up to 1 (`MAX(p_repeat_times, 1)`) — an
  // ENFORCED floor, error tier per ADR-0032.
  repeat_times: v.strictInt('repeat_times', { min: 1, enforced: 'parallax_2d.cpp:181' }),
  // parallax_2d.cpp:297, PROPERTY_HINT_NONE. set_limit_begin (:233-235) assigns
  // straight through.
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
