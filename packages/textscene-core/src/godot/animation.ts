/** Animation-playback facts shared by the AnimatedSprite family. */

/**
 * The name an AnimatedSprite's `animation` field already holds before a scene
 * assigns anything: `SceneStringName(default_)`, which
 * `scene/scene_string_names.h:131` declares as
 * `const StringName default_ = "default";`.
 *
 * It matters because both setters open by comparing against the current value
 * and returning — `animated_sprite_2d.cpp:554-556` and the identical
 * `sprite_3d.cpp:1432-1434`:
 *
 *     void AnimatedSprite2D::set_animation(const StringName &p_name) {
 *         if (animation == p_name) {
 *             return;
 *         }
 *
 * So `animation = "default"` never reaches the `frames.is_null()` branch that
 * clears the name and `ERR_FAIL_MSG`s. Godot loads that scene in silence, and a
 * rule that reports it is reporting a value the engine accepted.
 */
export const DEFAULT_ANIMATION_NAME = 'default';
