/**
 * What counts as a citation of the Godot source, one definition for every
 * grounding guard. `.glsl` counts: only `scene_forward_lights_inc.glsl:998`
 * grounds that ReflectionProbe's `ambient_color` (`light_storage.cpp:1817-1818`)
 * is inert outside `REFLECTION_AMBIENT_COLOR`. A directory prefix is optional.
 *
 * @example `scene/3d/light_3d.cpp:389` and `light_3d.cpp:389` both pass.
 */
export const ENGINE_CITE_RE = /\.(cpp|h|glsl):\d+/;

/** @example `ClassDB 4.6.3: Camera3D.near` */
const CAPTURE_CITE_RE = /\bClassDB \d+\.\d+\.\d+: \w+\.\S+/;

// ClassDB cannot report a refusal, so only a hint may cite the capture.
export function citesItsSource(grounding: { kind: 'enforced' | 'hinted'; cite: string }): boolean {
  if (ENGINE_CITE_RE.test(grounding.cite)) return true;
  return grounding.kind === 'hinted' && CAPTURE_CITE_RE.test(grounding.cite);
}
