/**
 * `opaque_prepass_threshold`: the alpha below which a depth draw of a `depth_prepass_alpha` or
 * alpha-antialiased surface writes nothing (`scene_forward_clustered.glsl:1426-1432`). Each pass
 * sets its own.
 */

/** The depth prepass before the opaque pass (`render_forward_clustered.cpp:1791`). */
export const DEPTH_PREPASS_OPAQUE_THRESHOLD = 0.99;

/** A shadow pass (`render_forward_clustered.cpp:2770`). */
export const SHADOW_PASS_OPAQUE_THRESHOLD = 0.1;
