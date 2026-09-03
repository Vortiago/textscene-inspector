/**
 * The vocabulary of a `[node]` heading — `scene/resources/packed_scene.cpp` and
 * the text loader that feeds it.
 *
 * These are here rather than beside either reader because BOTH node creators
 * spell them: the renderer's `NodeRegistry` and the linter's
 * `StrictTscnParser`. The two disagreeing about either one is a silent
 * divergence between what renders and what lints, and neither module is the
 * other's dependency.
 */

/**
 * The class Godot instantiates for an `instance_placeholder=` heading
 * (`packed_scene.cpp:255`). The placeholder is a real node with no children
 * until something replaces it.
 */
export const INSTANCE_PLACEHOLDER_TYPE = 'InstancePlaceholder';

/**
 * What a heading's `parent=` says when it names the scene's own root. Heading 0
 * is the root and may declare no parent at all (`packed_scene.cpp:218-219`), so
 * every path walk stops here rather than stepping above it.
 */
export const ROOT_PARENT_PATH = '.';
