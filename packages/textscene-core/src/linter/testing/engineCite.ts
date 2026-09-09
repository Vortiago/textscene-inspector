/**
 * What counts as a citation of the Godot source, for every grounding guard.
 *
 * One definition because five guards ask the same question — `emitsGrounding`,
 * `boundGrounding`, `rangeAdvisoryGrounding`, `configurationWarningCoverage` and
 * `ruleCoverage` — and a citation that satisfies one while failing another is a
 * contradiction the suite cannot resolve.
 *
 * `.glsl` alongside `.cpp`/`.h` because a shader is engine source too. Some
 * behaviour is decided nowhere else: ReflectionProbe's `ambient_color` is copied
 * into the reflection buffer unconditionally (`light_storage.cpp:1817-1818`) and
 * read only inside `case REFLECTION_AMBIENT_COLOR:`
 * (`scene_forward_lights_inc.glsl:998`), so the C++ side cannot ground the claim
 * that another ambient mode makes the value inert. Restricting the guard to C++
 * did not prevent that — it pushed the rule onto an editor-only
 * `_validate_property` line that grounds nothing, which is the worse outcome.
 *
 * A directory prefix is optional: `scene/3d/light_3d.cpp:389` and the bare
 * `light_3d.cpp:389` both pass, matching how slices actually write them.
 */
export const ENGINE_CITE_RE = /\.(cpp|h|glsl):\d+/;
