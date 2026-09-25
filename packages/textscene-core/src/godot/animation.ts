/** Animation-playback facts shared by the AnimatedSprite family. */

/**
 * The `animation` an AnimatedSprite holds before a scene assigns one: `SceneStringName(default_)`,
 * `"default"` (`scene/scene_string_names.h:131`). Both setters return on an unchanged value
 * (`animated_sprite_2d.cpp:554-556`, `sprite_3d.cpp:1432-1434`), so `animation = "default"` never
 * reaches the `frames.is_null()` `ERR_FAIL_MSG`: Godot loads it in silence, and no rule reports it.
 */
export const DEFAULT_ANIMATION_NAME = 'default';
