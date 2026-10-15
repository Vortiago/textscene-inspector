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
