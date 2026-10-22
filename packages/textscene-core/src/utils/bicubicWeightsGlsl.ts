/**
 * The weight functions of Godot's bicubic B-spline filter, which reads four bilinear taps in place of
 * sixteen texels (`tonemap.glsl:271-338`, `scene_forward_clustered.glsl:921-978`). Each filter wraps
 * them in its own tap code and sampler, so only the functions live here.
 */

/**
 * GLSL for `<prefix>W0` to `<prefix>W3` (the four spline weights), `<prefix>G0` and `<prefix>G1`
 * (the paired weights) and `<prefix>H0` and `<prefix>H1` (the tap offsets). The prefix keeps two
 * filters in one shader from colliding.
 */
export function bicubicWeightsGlsl(prefix: string): string {
  return /* glsl */ `
float ${prefix}W0( float a ) {
	return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
}

float ${prefix}W1( float a ) {
	return ( 1.0 / 6.0 ) * ( a * a * ( 3.0 * a - 6.0 ) + 4.0 );
}

float ${prefix}W2( float a ) {
	return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
}

float ${prefix}W3( float a ) {
	return ( 1.0 / 6.0 ) * ( a * a * a );
}

float ${prefix}G0( float a ) {
	return ${prefix}W0( a ) + ${prefix}W1( a );
}

float ${prefix}G1( float a ) {
	return ${prefix}W2( a ) + ${prefix}W3( a );
}

float ${prefix}H0( float a ) {
	return - 1.0 + ${prefix}W1( a ) / ( ${prefix}W0( a ) + ${prefix}W1( a ) );
}

float ${prefix}H1( float a ) {
	return 1.0 + ${prefix}W3( a ) / ( ${prefix}W2( a ) + ${prefix}W3( a ) );
}
`;
}
