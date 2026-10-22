/**
 * Godot's bicubic B-spline filter, which reads four bilinear taps in place of sixteen texels
 * (`tonemap.glsl:271-338`, `scene_forward_clustered.glsl:921-978`). The glow and the lightmap run
 * the same taps and differ only in where the size comes from and how a tap is fetched.
 */

/** What one filter supplies: its name, its texture's size and how it fetches a tap. */
export interface BicubicFilter {
  /** Names the filter `<prefix>Bicubic` and its weight functions, so two filters in one shader never collide. */
  prefix: string;
  /** The GLSL parameter list of `<prefix>Bicubic`. */
  params: string;
  /** The `vec2` uv expression the filter reads at. */
  uv: string;
  /** The `vec2` texel size expression of the texture. */
  size: string;
  /** The `vec3` colour expression of one bilinear tap at the `vec2` uv expression `texelUv`. */
  fetch: (texelUv: string) => string;
}

/** GLSL for `vec3 <prefix>Bicubic( <params> )` and the weight functions it calls. */
export function bicubicFilterGlsl(filter: BicubicFilter): string {
  const { prefix, fetch } = filter;
  return /* glsl */ `${bicubicWeightsGlsl(prefix)}
vec3 ${prefix}Bicubic( ${filter.params} ) {
	vec2 size = ${filter.size};
	vec2 texelSize = vec2( 1.0 ) / size;
	vec2 st = ${filter.uv} * size + vec2( 0.5 );
	vec2 iuv = floor( st );
	vec2 fuv = fract( st );
	float g0x = ${prefix}G0( fuv.x );
	float g1x = ${prefix}G1( fuv.x );
	float h0x = ${prefix}H0( fuv.x );
	float h1x = ${prefix}H1( fuv.x );
	float h0y = ${prefix}H0( fuv.y );
	float h1y = ${prefix}H1( fuv.y );
	vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - vec2( 0.5 ) ) * texelSize;
	vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - vec2( 0.5 ) ) * texelSize;
	vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - vec2( 0.5 ) ) * texelSize;
	vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - vec2( 0.5 ) ) * texelSize;
	return ( ${prefix}G0( fuv.y ) * ( g0x * ${fetch('p0')} + g1x * ${fetch('p1')} ) ) +
		( ${prefix}G1( fuv.y ) * ( g0x * ${fetch('p2')} + g1x * ${fetch('p3')} ) );
}
`;
}

/**
 * GLSL for `<prefix>W0` to `<prefix>W3` (the four spline weights), `<prefix>G0` and `<prefix>G1`
 * (the paired weights) and `<prefix>H0` and `<prefix>H1` (the tap offsets).
 */
function bicubicWeightsGlsl(prefix: string): string {
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
