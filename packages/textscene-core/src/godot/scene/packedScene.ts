/**
 * The vocabulary of a `[node]` heading: `scene/resources/packed_scene.cpp` and its text loader.
 * It lives here because both node creators spell it, the renderer's `NodeRegistry` and the
 * linter's `StrictTscnParser`, and neither depends on the other. Two copies would let what
 * renders and what lints diverge silently.
 */

/**
 * The class Godot instantiates for an `instance_placeholder=` heading
 * (`packed_scene.cpp:255`). The placeholder is a real node with no children
 * until something replaces it.
 */
export const INSTANCE_PLACEHOLDER_TYPE = 'InstancePlaceholder';
