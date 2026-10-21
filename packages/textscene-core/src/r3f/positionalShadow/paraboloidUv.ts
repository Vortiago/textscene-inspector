/**
 * Where a direction from an omni or area light lands in its paraboloid shadow, as GLSL that the lit
 * lookup and the volumetric fog share (`scene_forward_lights_inc.glsl:488-510`), so the two cannot
 * drift apart. A direction with z >= 0 reads the back paraboloid, `flipOffset` from the front one.
 */
export const PARABOLOID_UV_GLSL = /* glsl */ `
vec2 godotParaboloidUv( vec3 direction, vec4 uvRect, vec2 flipOffset ) {
	if ( direction.z >= 0.0 ) uvRect.xy += flipOffset;
	direction.z = 1.0 + abs( direction.z );
	return uvRect.xy + ( direction.xy / direction.z * 0.5 + 0.5 ) * uvRect.zw;
}
`;

/**
 * `godotOmniSlot( slot, inset, flipOffset )`: an omni light's `atlas_rect` and the step to its
 * second paraboloid, from the light's slot (`atlasOmniShadow.ts`), with `inset` taken off each side
 * of the rect. The surface insets the rect one atlas texel (`scene_forward_lights_inc.glsl:505-507`,
 * `:641-642`). The fog does not (`volumetric_fog_process.glsl:502-511`).
 */
export const OMNI_SLOT_GLSL = /* glsl */ `
vec4 godotOmniSlot( vec4 slot, vec2 inset, out vec2 flipOffset ) {
	flipOffset = slot.zw;
	float slotSize = max( flipOffset.x, flipOffset.y );
	return vec4( slot.xy + inset, vec2( slotSize ) - inset * 2.0 );
}
`;
