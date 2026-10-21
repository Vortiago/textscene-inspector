/**
 * The GLSL that reads a shadow atlas's depth as Godot's linear sampler does: the uv clamps to the
 * atlas, and the four nearest texels filter (`volumetric_fog_process.glsl:417`, `:507`, `:571`;
 * `scene_forward_lights_inc.glsl:398`). The soft shadow filter's blocker search and the volumetric
 * fog both read through it, each with the fetch that matches how its atlas stores the depth.
 */

/**
 * `float <name>( highp sampler2D atlas, vec2 uv )`. `texelDepth` names the includer's
 * `float <texelDepth>( highp sampler2D atlas, ivec2 texel )`, which gets a texel inside the atlas.
 * The uv clamps before it turns into a texel: past the int range the conversion is undefined, and
 * a cell beside a light's origin projects there.
 */
export function clampedBilinearDepthGlsl(name: string, texelDepth: string): string {
  return /* glsl */ `float ${name}( highp sampler2D atlas, vec2 uv ) {
	ivec2 size = textureSize( atlas, 0 );
	ivec2 last = size - 1;
	vec2 position = clamp( uv, 0.0, 1.0 ) * vec2( size ) - 0.5;
	ivec2 corner = ivec2( floor( position ) );
	vec2 weight = fract( position );
	float bottom = mix( ${texelDepth}( atlas, clamp( corner, ivec2( 0 ), last ) ), ${texelDepth}( atlas, clamp( corner + ivec2( 1, 0 ), ivec2( 0 ), last ) ), weight.x );
	float top = mix( ${texelDepth}( atlas, clamp( corner + ivec2( 0, 1 ), ivec2( 0 ), last ) ), ${texelDepth}( atlas, clamp( corner + ivec2( 1, 1 ), ivec2( 0 ), last ) ), weight.x );
	return mix( bottom, top, weight.y );
}
`;
}
