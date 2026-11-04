/**
 * The GLSL every screen-space pass shares to read the frame three drew: three's rows run bottom-up
 * and its depth runs from 0 at the near plane, where Godot's rows run top-down and its depth is
 * reversed.
 */

/**
 * Godot's depth from a three depth texel: reversed, 1 at the near plane and 0 at the far plane and
 * the background. Godot's projection maps the same view depth to `1 - depth` (`Projection::set_depth_correction`).
 */
export const GODOT_DEPTH = /* glsl */ `
float godotDepth( float threeDepth ) {
	return 1.0 - threeDepth;
}
`;

/** The texel of three's frame, whose rows run bottom-up, at Godot's pixel `pixel` of a frame `height` rows high. */
export const THREE_ROW = /* glsl */ `
ivec2 threeTexel( ivec2 pixel, int height ) {
	return ivec2( pixel.x, height - 1 - pixel.y );
}
`;

/**
 * A texel fetch that reads zero outside the texture, as Vulkan's robust image access does where a
 * pass of Godot's reads past an edge. WebGL leaves such a fetch undefined.
 */
export const FETCH_OR_ZERO = /* glsl */ `
vec4 fetchOrZero( highp sampler2D source, ivec2 texel, int level ) {
	ivec2 size = textureSize( source, level );
	if ( any( lessThan( texel, ivec2( 0 ) ) ) || any( greaterThanEqual( texel, size ) ) ) return vec4( 0.0 );
	return texelFetch( source, texel, level );
}
`;
