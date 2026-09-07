/**
 * The vocabulary of a `[node]` heading — `scene/resources/packed_scene.cpp` and
 * the text loader that feeds it.
 *
 * Here rather than beside either reader because BOTH node creators spell it:
 * the renderer's `NodeRegistry` and the linter's `StrictTscnParser`. The two
 * disagreeing is a silent divergence between what renders and what lints, and
 * neither module is the other's dependency.
 */

/**
 * The class Godot instantiates for an `instance_placeholder=` heading
 * (`packed_scene.cpp:255`). The placeholder is a real node with no children
 * until something replaces it.
 */
export const INSTANCE_PLACEHOLDER_TYPE = 'InstancePlaceholder';
