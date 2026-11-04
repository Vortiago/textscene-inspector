///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (c) 2016, Intel Corporation
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of
// the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
// THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The fragment shaders of Godot 4.6.3's screen-space ambient occlusion passes, Intel's ASSAO
 * (`servers/rendering/renderer_rd/shaders/effects/ss_effects_downsample.glsl` and `ssao*.glsl`),
 * each a compute pass that writes one texel per invocation, drawn here as one fragment per texel.
 * Every buffer of the passes holds Godot's rows, top-down, so a ported line reads the texel it reads
 * in Godot. Only a read of the frame three drew, and the scene's read of the result, turn the rows
 * over.
 */

import { FETCH_OR_ZERO, GODOT_DEPTH, THREE_ROW } from '../screenSpaceEffects/frameGlsl.js';

/**
 * Vulkan's sampling of a texel index: a coordinate snapped to the sub-texel steps of the reference
 * driver (`subTexelPrecisionBits` 8), and the wrap of each sampler the passes read. WebGL reads the
 * same texels through `texelFetch`, as three binds one sampler state per texture.
 */
const TEXEL_SAMPLING = /* glsl */ `
vec2 snappedTexelCoord( vec2 uv, ivec2 size ) {
	return round( uv * vec2( size ) * 256.0 ) / 256.0;
}

int mirroredIndex( int index, int size ) {
	int period = 2 * size;
	int wrapped = index - period * int( floor( float( index ) / float( period ) ) );
	return wrapped < size ? wrapped : period - 1 - wrapped;
}

ivec2 mirroredTexel( ivec2 texel, ivec2 size ) {
	return ivec2( mirroredIndex( texel.x, size.x ), mirroredIndex( texel.y, size.y ) );
}

ivec2 clampedTexel( ivec2 texel, ivec2 size ) {
	return clamp( texel, ivec2( 0 ), size - 1 );
}

// textureGather's footprint of \`uv\`: x is (i0, j1), y (i1, j1), z (i1, j0) and w (i0, j0).
ivec2 gatherOrigin( vec2 uv, ivec2 size ) {
	return ivec2( floor( snappedTexelCoord( uv, size ) - 0.5 ) );
}

vec4 gatherMirrored( highp sampler2D source, vec2 uv ) {
	ivec2 size = textureSize( source, 0 );
	ivec2 i0 = gatherOrigin( uv, size );
	ivec2 a = mirroredTexel( i0, size );
	ivec2 b = mirroredTexel( i0 + 1, size );
	return vec4(
		texelFetch( source, ivec2( a.x, b.y ), 0 ).x,
		texelFetch( source, b, 0 ).x,
		texelFetch( source, ivec2( b.x, a.y ), 0 ).x,
		texelFetch( source, a, 0 ).x
	);
}

vec4 gatherClamped( highp sampler2D source, vec2 uv ) {
	ivec2 size = textureSize( source, 0 );
	ivec2 i0 = gatherOrigin( uv, size );
	ivec2 a = clampedTexel( i0, size );
	ivec2 b = clampedTexel( i0 + 1, size );
	return vec4(
		texelFetch( source, ivec2( a.x, b.y ), 0 ).x,
		texelFetch( source, b, 0 ).x,
		texelFetch( source, ivec2( b.x, a.y ), 0 ).x,
		texelFetch( source, a, 0 ).x
	);
}

// The nearest texel of \`uv\` through the mirror sampler.
vec4 nearestMirrored( highp sampler2D source, vec2 uv ) {
	ivec2 size = textureSize( source, 0 );
	return texelFetch( source, mirroredTexel( ivec2( floor( snappedTexelCoord( uv, size ) ) ), size ), 0 );
}
`;

/** `unpack_edges` of the blur and the interleave, at their own sharpness uniform. */
function unpackEdges(sharpness: string): string {
  return /* glsl */ `
vec4 unpack_edges( float p_packed_val ) {
	uint packed_val = uint( p_packed_val * 255.5 );
	vec4 edgesLRTB;
	edgesLRTB.x = float( ( packed_val >> 6 ) & 3u ) / 3.0;
	edgesLRTB.y = float( ( packed_val >> 4 ) & 3u ) / 3.0;
	edgesLRTB.z = float( ( packed_val >> 2 ) & 3u ) / 3.0;
	edgesLRTB.w = float( ( packed_val >> 0 ) & 3u ) / 3.0;

	return clamp( edgesLRTB + ${sharpness}, 0.0, 1.0 );
}
`;
}

/**
 * `ss_effects_downsample.glsl` without its mips: the frame's depth, linear, into the four
 * deinterleaved slices. Its gather reads `(i0, j0)`, `(i1, j0)`, `(i0, j1)` and `(i1, j1)` into
 * slices 0 to 3, at the texel the sample sits on. `USE_HALF_BUFFERS` writes slices 0 and 3 only,
 * and the others hold the same, which no pass reads.
 */
export const DEPTH_DOWNSAMPLE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

uniform highp sampler2D source_depth;
uniform float z_far;
uniform float z_near;
uniform bool orthogonal;

layout( location = 0 ) out highp vec4 slice0;
layout( location = 1 ) out highp vec4 slice1;
layout( location = 2 ) out highp vec4 slice2;
layout( location = 3 ) out highp vec4 slice3;

${GODOT_DEPTH}
${THREE_ROW}

float screen_space_to_view_space_depth( float p_depth ) {
	if ( orthogonal ) {
		float depth = p_depth * 2.0 - 1.0;
		return -( depth * ( z_far - z_near ) - ( z_far + z_near ) ) / 2.0;
	}
	return z_near / ( z_far - p_depth );
}

// The default sampler clamps a read past the frame's edge.
float viewDepthAt( ivec2 pixel ) {
	ivec2 size = textureSize( source_depth, 0 );
	ivec2 texel = threeTexel( clamp( pixel, ivec2( 0 ), size - 1 ), size.y );
	return screen_space_to_view_space_depth( godotDepth( texelFetch( source_depth, texel, 0 ).x ) );
}

void main() {
#ifdef USE_HALF_SIZE
	const int stride = 4;
	const int sampleStep = 2;
#else
	const int stride = 2;
	const int sampleStep = 1;
#endif
	ivec2 base = stride * ivec2( gl_FragCoord.xy );
	slice0 = vec4( viewDepthAt( base ) );
	slice3 = vec4( viewDepthAt( base + ivec2( sampleStep ) ) );
#ifdef USE_HALF_BUFFERS
	slice1 = slice0;
	slice2 = slice3;
#else
	slice1 = vec4( viewDepthAt( base + ivec2( sampleStep, 0 ) ) );
	slice2 = vec4( viewDepthAt( base + ivec2( 0, sampleStep ) ) );
#endif
}
`;

/**
 * One mip of `prepare_depths_and_mips` for all four slices: the smart average of each slice's
 * two-by-two block one level down. Mip 3 averages mip 2, as Godot's mip 2 does: its row test reads
 * `depth_array_offset.y % 8`, which keeps every row alive to race for the texel. Mip 4 keeps the mip
 * 3 texel at its corner, the "previous average" its comment names.
 */
export const DEPTH_MIP_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

uniform highp sampler2D source0;
uniform highp sampler2D source1;
uniform highp sampler2D source2;
uniform highp sampler2D source3;
uniform bool keepsCorner;

layout( location = 0 ) out highp vec4 slice0;
layout( location = 1 ) out highp vec4 slice1;
layout( location = 2 ) out highp vec4 slice2;
layout( location = 3 ) out highp vec4 slice3;

// Godot's downsample sets radius_sq to 1 (\`ss_effects.cpp:598\`).
float mip_smart_average( vec4 p_depths ) {
	float closest = min( min( p_depths.x, p_depths.y ), min( p_depths.z, p_depths.w ) );
	float fallof_sq = -1.0 / 1.0;
	vec4 dists = p_depths - vec4( closest );
	vec4 weights = clamp( dists * dists * fallof_sq + 1.0, 0.0, 1.0 );
	return dot( weights, p_depths ) / dot( weights, vec4( 1.0, 1.0, 1.0, 1.0 ) );
}

float mipOf( highp sampler2D source, ivec2 texel ) {
	ivec2 corner = 2 * texel;
	float sample_00 = texelFetch( source, corner, 0 ).x;
	if ( keepsCorner ) return sample_00;
	float sample_01 = texelFetch( source, corner + ivec2( 0, 1 ), 0 ).x;
	float sample_10 = texelFetch( source, corner + ivec2( 1, 0 ), 0 ).x;
	float sample_11 = texelFetch( source, corner + ivec2( 1, 1 ), 0 ).x;
	return mip_smart_average( vec4( sample_00, sample_01, sample_10, sample_11 ) );
}

void main() {
	ivec2 texel = ivec2( gl_FragCoord.xy );
	slice0 = vec4( mipOf( source0, texel ) );
	slice1 = vec4( mipOf( source1, texel ) );
	slice2 = vec4( mipOf( source2, texel ) );
	slice3 = vec4( mipOf( source3, texel ) );
}
`;

/**
 * `ssao.glsl` for one slice, `pass`. The depth mips of the slice are four textures, read through
 * Vulkan's nearest mip of the mirror sampler (`max_lod` 4 over a view of four levels). Godot's tilt
 * of the mirrored taps turns on at a quality no setting reaches, and its detail skips a quality 4
 * none reaches either, so neither is here. `SSAO_BASE` is the adaptive base pass, `ADAPTIVE` Ultra's
 * gather.
 */
export const GATHER_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

#define INTELSSAO_MAIN_DISK_SAMPLE_COUNT (32)
const vec4 sample_pattern[INTELSSAO_MAIN_DISK_SAMPLE_COUNT] = vec4[](
	vec4(0.78488064, 0.56661671, 1.500000, -0.126083), vec4(0.26022232, -0.29575172, 1.500000, -1.064030), vec4(0.10459357, 0.08372527, 1.110000, -2.730563), vec4(-0.68286800, 0.04963045, 1.090000, -0.498827),
	vec4(-0.13570161, -0.64190155, 1.250000, -0.532765), vec4(-0.26193795, -0.08205118, 0.670000, -1.783245), vec4(-0.61177456, 0.66664219, 0.710000, -0.044234), vec4(0.43675563, 0.25119025, 0.610000, -1.167283),
	vec4(0.07884444, 0.86618668, 0.640000, -0.459002), vec4(-0.12790935, -0.29869005, 0.600000, -1.729424), vec4(-0.04031125, 0.02413622, 0.600000, -4.792042), vec4(0.16201244, -0.52851415, 0.790000, -1.067055),
	vec4(-0.70991218, 0.47301072, 0.640000, -0.335236), vec4(0.03277707, -0.22349690, 0.600000, -1.982384), vec4(0.68921727, 0.36800742, 0.630000, -0.266718), vec4(0.29251814, 0.37775412, 0.610000, -1.422520),
	vec4(-0.12224089, 0.96582592, 0.600000, -0.426142), vec4(0.11071457, -0.16131058, 0.600000, -2.165947), vec4(0.46562141, -0.59747696, 0.600000, -0.189760), vec4(-0.51548797, 0.11804193, 0.600000, -1.246800),
	vec4(0.89141309, -0.42090443, 0.600000, 0.028192), vec4(-0.32402530, -0.01591529, 0.600000, -1.543018), vec4(0.60771245, 0.41635221, 0.600000, -0.605411), vec4(0.02379565, -0.08239821, 0.600000, -3.809046),
	vec4(0.48951152, -0.23657045, 0.600000, -1.189011), vec4(-0.17611565, -0.81696892, 0.600000, -0.513724), vec4(-0.33930185, -0.20732205, 0.600000, -1.698047), vec4(-0.91974425, 0.05403209, 0.600000, 0.062246),
	vec4(-0.15064627, -0.14949332, 0.600000, -1.896062), vec4(0.53180975, -0.35210401, 0.600000, -0.758838), vec4(0.41487166, 0.81442589, 0.600000, -0.505648), vec4(-0.24106961, -0.32721516, 0.600000, -1.665244)
);

const int num_taps[5] = int[]( 3, 5, 12, 0, 0 );

#define SSAO_HALOING_REDUCTION_ENABLE_AT_QUALITY_PRESET (1)
#define SSAO_HALOING_REDUCTION_AMOUNT (0.6)
#define SSAO_NORMAL_BASED_EDGES_ENABLE_AT_QUALITY_PRESET (2)
#define SSAO_NORMAL_BASED_EDGES_DOT_THRESHOLD (0.5)
#define SSAO_DETAIL_AO_ENABLE_AT_QUALITY_PRESET (1)
#define SSAO_DEPTH_MIPS_ENABLE_AT_QUALITY_PRESET (2)
#define SSAO_DEPTH_MIPS_GLOBAL_OFFSET (-4.3)
#define SSAO_DEPTH_BASED_EDGES_ENABLE_AT_QUALITY_PRESET (1)
#define SSAO_REDUCE_RADIUS_NEAR_SCREEN_BORDER_ENABLE_AT_QUALITY_PRESET (1)

#define SSAO_MAX_TAPS 32
#define SSAO_ADAPTIVE_TAP_BASE_COUNT 5
#define SSAO_ADAPTIVE_TAP_FLEXIBLE_COUNT (SSAO_MAX_TAPS - SSAO_ADAPTIVE_TAP_BASE_COUNT)
#define SSAO_DEPTH_MIP_LEVELS 4

uniform highp sampler2D source_depth0;
uniform highp sampler2D source_depth1;
uniform highp sampler2D source_depth2;
uniform highp sampler2D source_depth3;
uniform highp sampler2D source_normal;
uniform vec4 rotation_matrices[ 20 ];

#ifdef ADAPTIVE
uniform highp sampler2D source_ssao;
uniform highp sampler2D source_importance;
uniform highp sampler2D load_counter;
#endif

uniform int pass;
uniform int quality;
uniform vec2 half_screen_pixel_size;
uniform int size_multiplier;
uniform float detail_intensity;
uniform vec2 NDC_to_view_mul;
uniform vec2 NDC_to_view_add;
uniform vec2 half_screen_pixel_size_x025;
uniform float radius;
uniform float intensity;
uniform float shadow_power;
uniform float shadow_clamp;
uniform float fade_out_mul;
uniform float fade_out_add;
uniform float horizon_angle_threshold;
uniform float inv_radius_near_limit;
uniform bool is_orthogonal;
uniform float neg_inv_radius;
uniform float load_counter_avg_div;
uniform float adaptive_sample_limit;
uniform ivec2 pass_coord_offset;
uniform vec2 pass_uv_offset;

${TEXEL_SAMPLING}
${THREE_ROW}
${FETCH_OR_ZERO}

float pack_edges( vec4 p_edgesLRTB ) {
	p_edgesLRTB = round( clamp( p_edgesLRTB, 0.0, 1.0 ) * 3.05 );
	return dot( p_edgesLRTB, vec4( 64.0 / 255.0, 16.0 / 255.0, 4.0 / 255.0, 1.0 / 255.0 ) );
}

vec3 NDC_to_view_space( vec2 p_pos, float p_viewspace_depth ) {
	if ( is_orthogonal ) {
		return vec3( ( NDC_to_view_mul * p_pos.xy + NDC_to_view_add ), p_viewspace_depth );
	} else {
		return vec3( ( NDC_to_view_mul * p_pos.xy + NDC_to_view_add ) * p_viewspace_depth, p_viewspace_depth );
	}
}

void calculate_radius_parameters( const float p_pix_center_length, const vec2 p_pixel_size_at_center, out float r_lookup_radius, out float r_radius, out float r_fallof_sq ) {
	r_radius = radius;

	float too_close_limit = clamp( p_pix_center_length * inv_radius_near_limit, 0.0, 1.0 ) * 0.8 + 0.2;

	r_radius *= too_close_limit;

	r_lookup_radius = ( 0.85 * r_radius ) / p_pixel_size_at_center.x;

	r_fallof_sq = -1.0 / ( r_radius * r_radius );
}

vec4 calculate_edges( const float p_center_z, const float p_left_z, const float p_right_z, const float p_top_z, const float p_bottom_z ) {
	vec4 edgesLRTB = vec4( p_left_z, p_right_z, p_top_z, p_bottom_z ) - p_center_z;
	vec4 edgesLRTB_slope_adjusted = edgesLRTB + edgesLRTB.yxwz;
	edgesLRTB = min( abs( edgesLRTB ), abs( edgesLRTB_slope_adjusted ) );
	return clamp( ( 1.3 - edgesLRTB / ( p_center_z * 0.040 ) ), 0.0, 1.0 );
}

// imageLoad of Godot's normal buffer: three's frame, its rows turned over, zero past an edge.
vec3 load_normal( ivec2 p_pos ) {
	ivec2 size = textureSize( source_normal, 0 );
	ivec2 texel = threeTexel( p_pos, size.y );
	vec3 encoded_normal = normalize( fetchOrZero( source_normal, texel, 0 ).xyz * 2.0 - 1.0 );
	encoded_normal.z = -encoded_normal.z;
	return encoded_normal;
}

vec3 load_normal( ivec2 p_pos, ivec2 p_offset ) {
	return load_normal( p_pos + p_offset );
}

// Level \`level\` of the slice's depth mips.
float depthTexel( int level, vec2 uv ) {
	if ( level == 0 ) return nearestMirrored( source_depth0, uv ).x;
	if ( level == 1 ) return nearestMirrored( source_depth1, uv ).x;
	if ( level == 2 ) return nearestMirrored( source_depth2, uv ).x;
	return nearestMirrored( source_depth3, uv ).x;
}

// Vulkan's nearest mip: the level clamped to the view's, rounded with its preferred rule.
float sampleDepth( vec2 uv, float lod ) {
	float level = clamp( lod, 0.0, float( SSAO_DEPTH_MIP_LEVELS - 1 ) );
	return depthTexel( int( ceil( level + 0.5 ) ) - 1, uv );
}

float calculate_pixel_obscurance( vec3 p_pixel_normal, vec3 p_hit_delta, float p_fallof_sq ) {
	float length_sq = dot( p_hit_delta, p_hit_delta );
	float NdotD = dot( p_pixel_normal, p_hit_delta ) / sqrt( length_sq );

	float falloff_mult = max( 0.0, length_sq * p_fallof_sq + 1.0 );

	return max( 0.0, NdotD - horizon_angle_threshold ) * falloff_mult;
}

void SSAO_tap_inner( const int p_quality_level, inout float r_obscurance_sum, inout float r_weight_sum, const vec2 p_sampling_uv, const float p_mip_level, const vec3 p_pix_center_pos, vec3 p_pixel_normal, const float p_fallof_sq, const float p_weight_mod ) {
	float viewspace_sample_z = sampleDepth( p_sampling_uv, p_mip_level );

	vec3 hit_pos = NDC_to_view_space( p_sampling_uv.xy, viewspace_sample_z ).xyz;
	vec3 hit_delta = hit_pos - p_pix_center_pos;

	float obscurance = calculate_pixel_obscurance( p_pixel_normal, hit_delta, p_fallof_sq );
	float weight = 1.0;

	if ( p_quality_level >= SSAO_HALOING_REDUCTION_ENABLE_AT_QUALITY_PRESET ) {
		float reduce = max( 0.0, -hit_delta.z );
		reduce = clamp( reduce * neg_inv_radius + 2.0, 0.0, 1.0 );
		weight = SSAO_HALOING_REDUCTION_AMOUNT * reduce + ( 1.0 - SSAO_HALOING_REDUCTION_AMOUNT );
	}
	weight *= p_weight_mod;
	r_obscurance_sum += obscurance * weight;
	r_weight_sum += weight;
}

void SSAOTap( const int p_quality_level, inout float r_obscurance_sum, inout float r_weight_sum, const int p_tap_index, const mat2 p_rot_scale, const vec3 p_pix_center_pos, vec3 p_pixel_normal, const vec2 p_normalized_screen_pos, const float p_mip_offset, const float p_fallof_sq, float p_weight_mod ) {
	vec2 sample_offset;
	float sample_pow_2_len;

	{
		vec4 new_sample = sample_pattern[ p_tap_index ];
		sample_offset = new_sample.xy * p_rot_scale;
		sample_pow_2_len = new_sample.w;
		p_weight_mod *= new_sample.z;
	}

	sample_offset = round( sample_offset );

	float mip_level = ( p_quality_level < SSAO_DEPTH_MIPS_ENABLE_AT_QUALITY_PRESET ) ? ( 0.0 ) : ( sample_pow_2_len + p_mip_offset );

	vec2 sampling_uv = sample_offset * half_screen_pixel_size + p_normalized_screen_pos;

	SSAO_tap_inner( p_quality_level, r_obscurance_sum, r_weight_sum, sampling_uv, mip_level, p_pix_center_pos, p_pixel_normal, p_fallof_sq, p_weight_mod );

	vec2 sample_offset_mirrored_uv = -sample_offset;

	vec2 sampling_mirrored_uv = sample_offset_mirrored_uv * half_screen_pixel_size + p_normalized_screen_pos;

	SSAO_tap_inner( p_quality_level, r_obscurance_sum, r_weight_sum, sampling_mirrored_uv, mip_level, p_pix_center_pos, p_pixel_normal, p_fallof_sq, p_weight_mod );
}

void generate_SSAO_shadows_internal( out float r_shadow_term, out vec4 r_edges, out float r_weight, const vec2 p_pos, int p_quality_level, bool p_adaptive_base ) {
	vec2 pos_rounded = trunc( p_pos );
	uvec2 upos = uvec2( pos_rounded );

	int number_of_taps = ( p_adaptive_base ) ? ( SSAO_ADAPTIVE_TAP_BASE_COUNT ) : ( num_taps[ p_quality_level ] );
	float pix_z, pix_left_z, pix_top_z, pix_right_z, pix_bottom_z;

	vec4 valuesUL = gatherMirrored( source_depth0, pos_rounded * half_screen_pixel_size );
	vec4 valuesBR = gatherMirrored( source_depth0, ( pos_rounded + vec2( 1.0 ) ) * half_screen_pixel_size );

	pix_z = valuesUL.y;

	pix_left_z = valuesUL.x;
	pix_top_z = valuesUL.z;
	pix_right_z = valuesBR.z;
	pix_bottom_z = valuesBR.x;

	vec2 normalized_screen_pos = pos_rounded * half_screen_pixel_size + half_screen_pixel_size_x025;
	vec3 pix_center_pos = NDC_to_view_space( normalized_screen_pos, pix_z );

	uvec2 full_res_coord = upos * 2u * uint( size_multiplier ) + uvec2( pass_coord_offset.xy );
	vec3 pixel_normal = load_normal( ivec2( full_res_coord ) );

	vec2 pixel_size_at_center = NDC_to_view_space( normalized_screen_pos.xy + half_screen_pixel_size, pix_center_pos.z ).xy - pix_center_pos.xy;

	float pixel_lookup_radius;
	float fallof_sq;

	float viewspace_radius;
	calculate_radius_parameters( length( pix_center_pos ), pixel_size_at_center, pixel_lookup_radius, viewspace_radius, fallof_sq );

	mat2 rot_scale_matrix;
	uint pseudo_random_index;

	{
		vec4 rotation_scale;
		if ( !p_adaptive_base && ( p_quality_level >= SSAO_REDUCE_RADIUS_NEAR_SCREEN_BORDER_ENABLE_AT_QUALITY_PRESET ) ) {
			float near_screen_border = min( min( normalized_screen_pos.x, 1.0 - normalized_screen_pos.x ), min( normalized_screen_pos.y, 1.0 - normalized_screen_pos.y ) );
			near_screen_border = clamp( 10.0 * near_screen_border + 0.6, 0.0, 1.0 );
			pixel_lookup_radius *= near_screen_border;
		}

		pseudo_random_index = uint( pos_rounded.y * 2.0 + pos_rounded.x ) % 5u;
		rotation_scale = rotation_matrices[ pass * 5 + int( pseudo_random_index ) ];
		rot_scale_matrix = mat2( rotation_scale.x * pixel_lookup_radius, rotation_scale.y * pixel_lookup_radius, rotation_scale.z * pixel_lookup_radius, rotation_scale.w * pixel_lookup_radius );
	}

	float obscurance_sum = 0.0;
	float weight_sum = 0.0;

	vec4 edgesLRTB = vec4( 1.0, 1.0, 1.0, 1.0 );

	pix_center_pos *= 0.99;

	if ( !p_adaptive_base && ( p_quality_level >= SSAO_DEPTH_BASED_EDGES_ENABLE_AT_QUALITY_PRESET ) ) {
		edgesLRTB = calculate_edges( pix_z, pix_left_z, pix_right_z, pix_top_z, pix_bottom_z );
	}

	if ( !p_adaptive_base && ( p_quality_level >= SSAO_DETAIL_AO_ENABLE_AT_QUALITY_PRESET ) ) {
		vec3 normalized_viewspace_dir = vec3( pix_center_pos.xy / pix_center_pos.zz, 1.0 );
		vec3 pixel_left_delta = vec3( -pixel_size_at_center.x, 0.0, 0.0 ) + normalized_viewspace_dir * ( pix_left_z - pix_center_pos.z );
		vec3 pixel_right_delta = vec3( +pixel_size_at_center.x, 0.0, 0.0 ) + normalized_viewspace_dir * ( pix_right_z - pix_center_pos.z );
		vec3 pixel_top_delta = vec3( 0.0, -pixel_size_at_center.y, 0.0 ) + normalized_viewspace_dir * ( pix_top_z - pix_center_pos.z );
		vec3 pixel_bottom_delta = vec3( 0.0, +pixel_size_at_center.y, 0.0 ) + normalized_viewspace_dir * ( pix_bottom_z - pix_center_pos.z );

		const float range_reduction = 4.0;
		float modified_fallof_sq = range_reduction * fallof_sq;

		vec4 additional_obscurance;
		additional_obscurance.x = calculate_pixel_obscurance( pixel_normal, pixel_left_delta, modified_fallof_sq );
		additional_obscurance.y = calculate_pixel_obscurance( pixel_normal, pixel_right_delta, modified_fallof_sq );
		additional_obscurance.z = calculate_pixel_obscurance( pixel_normal, pixel_top_delta, modified_fallof_sq );
		additional_obscurance.w = calculate_pixel_obscurance( pixel_normal, pixel_bottom_delta, modified_fallof_sq );

		obscurance_sum += detail_intensity * dot( additional_obscurance, edgesLRTB );
	}

	if ( !p_adaptive_base && ( p_quality_level >= SSAO_NORMAL_BASED_EDGES_ENABLE_AT_QUALITY_PRESET ) ) {
		vec3 neighbour_normal_left = load_normal( ivec2( full_res_coord ), ivec2( -2, 0 ) );
		vec3 neighbour_normal_right = load_normal( ivec2( full_res_coord ), ivec2( 2, 0 ) );
		vec3 neighbour_normal_top = load_normal( ivec2( full_res_coord ), ivec2( 0, -2 ) );
		vec3 neighbour_normal_bottom = load_normal( ivec2( full_res_coord ), ivec2( 0, 2 ) );

		const float dot_threshold = SSAO_NORMAL_BASED_EDGES_DOT_THRESHOLD;

		vec4 normal_edgesLRTB;
		normal_edgesLRTB.x = clamp( ( dot( pixel_normal, neighbour_normal_left ) + dot_threshold ), 0.0, 1.0 );
		normal_edgesLRTB.y = clamp( ( dot( pixel_normal, neighbour_normal_right ) + dot_threshold ), 0.0, 1.0 );
		normal_edgesLRTB.z = clamp( ( dot( pixel_normal, neighbour_normal_top ) + dot_threshold ), 0.0, 1.0 );
		normal_edgesLRTB.w = clamp( ( dot( pixel_normal, neighbour_normal_bottom ) + dot_threshold ), 0.0, 1.0 );

		edgesLRTB *= normal_edgesLRTB;
	}

	const float global_mip_offset = SSAO_DEPTH_MIPS_GLOBAL_OFFSET;
	float mip_offset = ( p_quality_level < SSAO_DEPTH_MIPS_ENABLE_AT_QUALITY_PRESET ) ? ( 0.0 ) : ( log2( pixel_lookup_radius ) + global_mip_offset );

	if ( ( p_quality_level != 3 ) || p_adaptive_base ) {
		for ( int i = 0; i < number_of_taps; i++ ) {
			SSAOTap( p_quality_level, obscurance_sum, weight_sum, i, rot_scale_matrix, pix_center_pos, pixel_normal, normalized_screen_pos, mip_offset, fallof_sq, 1.0 );
		}
	}
#ifdef ADAPTIVE
	else {
		vec2 full_res_uv = normalized_screen_pos + pass_uv_offset.xy;
		float importance = textureLod( source_importance, full_res_uv, 0.0 ).x;

		obscurance_sum *= ( float( SSAO_ADAPTIVE_TAP_BASE_COUNT ) / float( SSAO_MAX_TAPS ) ) + ( importance * float( SSAO_ADAPTIVE_TAP_FLEXIBLE_COUNT ) / float( SSAO_MAX_TAPS ) );

		vec2 base_values = texelFetch( source_ssao, ivec2( upos ), 0 ).xy;
		weight_sum += base_values.y * float( SSAO_ADAPTIVE_TAP_BASE_COUNT ) * 4.0;
		obscurance_sum += ( base_values.x ) * weight_sum;

		float avg_total_importance = texelFetch( load_counter, ivec2( 0 ), 0 ).x * load_counter_avg_div;

		float importance_limiter = clamp( adaptive_sample_limit / avg_total_importance, 0.0, 1.0 );
		importance *= importance_limiter;

		float additional_sample_count = float( SSAO_ADAPTIVE_TAP_FLEXIBLE_COUNT ) * importance;

		const float blend_range = 3.0;
		const float blend_range_inv = 1.0 / blend_range;

		additional_sample_count += 0.5;
		uint additional_samples = uint( additional_sample_count );
		uint additional_samples_to = min( uint( SSAO_MAX_TAPS ), additional_samples + uint( SSAO_ADAPTIVE_TAP_BASE_COUNT ) );

		for ( uint i = uint( SSAO_ADAPTIVE_TAP_BASE_COUNT ); i < additional_samples_to; i++ ) {
			additional_sample_count -= 1.0;
			float weight_mod = clamp( additional_sample_count * blend_range_inv, 0.0, 1.0 );
			SSAOTap( p_quality_level, obscurance_sum, weight_sum, int( i ), rot_scale_matrix, pix_center_pos, pixel_normal, normalized_screen_pos, mip_offset, fallof_sq, weight_mod );
		}
	}
#endif

	if ( p_adaptive_base ) {
		float obscurance = obscurance_sum / weight_sum;

		r_shadow_term = obscurance;
		r_edges = vec4( 0.0 );
		r_weight = weight_sum;
		return;
	}

	float obscurance = obscurance_sum / weight_sum;

	float fade_out = clamp( pix_center_pos.z * fade_out_mul + fade_out_add, 0.0, 1.0 );

	if ( !p_adaptive_base && ( p_quality_level >= SSAO_DEPTH_BASED_EDGES_ENABLE_AT_QUALITY_PRESET ) ) {
		float edge_fadeout_factor = clamp( ( 1.0 - edgesLRTB.x - edgesLRTB.y ) * 0.35, 0.0, 1.0 ) + clamp( ( 1.0 - edgesLRTB.z - edgesLRTB.w ) * 0.35, 0.0, 1.0 );

		fade_out *= clamp( 1.0 - edge_fadeout_factor, 0.0, 1.0 );
	}

	obscurance = intensity * obscurance;

	obscurance = min( obscurance, shadow_clamp );

	obscurance *= fade_out;

	float occlusion = 1.0 - obscurance;

	occlusion = pow( clamp( occlusion, 0.0, 1.0 ), shadow_power );

	r_shadow_term = occlusion;
	r_edges = edgesLRTB;
	r_weight = weight_sum;
}

void main() {
	float out_shadow_term;
	float out_weight;
	vec4 out_edges;
	vec2 uv = floor( gl_FragCoord.xy ) + vec2( 0.5 );
#ifdef SSAO_BASE
	generate_SSAO_shadows_internal( out_shadow_term, out_edges, out_weight, uv, quality, true );

	gl_FragColor = vec4( out_shadow_term, out_weight / ( float( SSAO_ADAPTIVE_TAP_BASE_COUNT ) * 4.0 ), 0.0, 0.0 );
#else
	generate_SSAO_shadows_internal( out_shadow_term, out_edges, out_weight, uv, quality, false );
	if ( quality == 0 ) {
		out_edges = vec4( 1.0 );
	}

	gl_FragColor = vec4( out_shadow_term, pack_edges( out_edges ), 0.0, 0.0 );
#endif
}
`;

/**
 * `ssao_blur.glsl` for one slice. `MODE_NON_SMART`, Very Low's, reads through the default linear
 * sampler, which the slice's own filter gives. The others read through the mirror sampler.
 */
export const BLUR_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

uniform highp sampler2D source_ssao;
uniform float edge_sharpness;
uniform vec2 half_screen_pixel_size;

${TEXEL_SAMPLING}
${unpackEdges('edge_sharpness')}

void add_sample( float p_ssao_value, float p_edge_value, inout float r_sum, inout float r_sum_weight ) {
	float weight = p_edge_value;

	r_sum += ( weight * p_ssao_value );
	r_sum_weight += weight;
}

#ifdef MODE_WIDE
// textureLodOffset through the mirror sampler, at the texel centre \`p_coord\` sits on.
vec2 offsetTexel( ivec2 texel, ivec2 offset ) {
	ivec2 size = textureSize( source_ssao, 0 );
	return texelFetch( source_ssao, mirroredTexel( texel + offset, size ), 0 ).xy;
}

vec2 sample_blurred_wide( ivec2 texel ) {
	vec2 vC = offsetTexel( texel, ivec2( 0, 0 ) );
	vec2 vL = offsetTexel( texel, ivec2( -2, 0 ) );
	vec2 vT = offsetTexel( texel, ivec2( 0, -2 ) );
	vec2 vR = offsetTexel( texel, ivec2( 2, 0 ) );
	vec2 vB = offsetTexel( texel, ivec2( 0, 2 ) );

	float packed_edges = vC.y;
	vec4 edgesLRTB = unpack_edges( packed_edges );
	edgesLRTB.x *= unpack_edges( vL.y ).y;
	edgesLRTB.z *= unpack_edges( vT.y ).w;
	edgesLRTB.y *= unpack_edges( vR.y ).x;
	edgesLRTB.w *= unpack_edges( vB.y ).z;

	float ssao_value = vC.x;
	float ssao_valueL = vL.x;
	float ssao_valueT = vT.x;
	float ssao_valueR = vR.x;
	float ssao_valueB = vB.x;

	float sum_weight = 0.8;
	float sum = ssao_value * sum_weight;

	add_sample( ssao_valueL, edgesLRTB.x, sum, sum_weight );
	add_sample( ssao_valueR, edgesLRTB.y, sum, sum_weight );
	add_sample( ssao_valueT, edgesLRTB.z, sum, sum_weight );
	add_sample( ssao_valueB, edgesLRTB.w, sum, sum_weight );

	float ssao_avg = sum / sum_weight;

	ssao_value = ssao_avg;

	return vec2( ssao_value, packed_edges );
}
#endif

#ifdef MODE_SMART
vec2 sample_blurred( ivec2 p_pos, vec2 p_coord ) {
	float packed_edges = texelFetch( source_ssao, p_pos, 0 ).y;
	vec4 edgesLRTB = unpack_edges( packed_edges );

	vec4 valuesUL = gatherMirrored( source_ssao, p_coord - half_screen_pixel_size * 0.5 );
	vec4 valuesBR = gatherMirrored( source_ssao, p_coord + half_screen_pixel_size * 0.5 );

	float ssao_value = valuesUL.y;
	float ssao_valueL = valuesUL.x;
	float ssao_valueT = valuesUL.z;
	float ssao_valueR = valuesBR.z;
	float ssao_valueB = valuesBR.x;

	float sum_weight = 0.5;
	float sum = ssao_value * sum_weight;

	add_sample( ssao_valueL, edgesLRTB.x, sum, sum_weight );
	add_sample( ssao_valueR, edgesLRTB.y, sum, sum_weight );

	add_sample( ssao_valueT, edgesLRTB.z, sum, sum_weight );
	add_sample( ssao_valueB, edgesLRTB.w, sum, sum_weight );

	float ssao_avg = sum / sum_weight;

	ssao_value = ssao_avg;

	return vec2( ssao_value, packed_edges );
}
#endif

void main() {
	ivec2 ssC = ivec2( gl_FragCoord.xy );
	vec2 coord = ( vec2( ssC ) + vec2( 0.5, 0.5 ) ) * half_screen_pixel_size;

#ifdef MODE_NON_SMART

	vec2 half_pixel = half_screen_pixel_size * 0.5;

	vec2 center = textureLod( source_ssao, coord, 0.0 ).xy;

	vec4 vals;
	vals.x = textureLod( source_ssao, vec2( coord + vec2( -half_pixel.x * 3.0, -half_pixel.y ) ), 0.0 ).x;
	vals.y = textureLod( source_ssao, vec2( coord + vec2( +half_pixel.x, -half_pixel.y * 3.0 ) ), 0.0 ).x;
	vals.z = textureLod( source_ssao, vec2( coord + vec2( -half_pixel.x, +half_pixel.y * 3.0 ) ), 0.0 ).x;
	vals.w = textureLod( source_ssao, vec2( coord + vec2( +half_pixel.x * 3.0, +half_pixel.y ) ), 0.0 ).x;

	vec2 sampled = vec2( dot( vals, vec4( 0.2 ) ) + center.x * 0.2, center.y );

#elif defined( MODE_SMART )
	vec2 sampled = sample_blurred( ssC, coord );
#else
	vec2 sampled = sample_blurred_wide( ssC );
#endif
	gl_FragColor = vec4( sampled, 0.0, 0.0 );
}
`;

/**
 * `ssao_interleave.glsl`: the four slices back to the frame, through the default linear sampler,
 * which each slice's own filter gives.
 */
export const INTERLEAVE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

uniform highp sampler2D source0;
uniform highp sampler2D source1;
uniform highp sampler2D source2;
uniform highp sampler2D source3;
uniform float inv_sharpness;
uniform int size_modifier;
uniform vec2 pixel_size;

${unpackEdges('inv_sharpness')}

vec4 sliceAt( int index, vec2 uv ) {
	if ( index == 0 ) return textureLod( source0, uv, 0.0 );
	if ( index == 1 ) return textureLod( source1, uv, 0.0 );
	if ( index == 2 ) return textureLod( source2, uv, 0.0 );
	return textureLod( source3, uv, 0.0 );
}

vec4 sliceTexel( int index, ivec2 texel ) {
	if ( index == 0 ) return texelFetch( source0, texel, 0 );
	if ( index == 1 ) return texelFetch( source1, texel, 0 );
	if ( index == 2 ) return texelFetch( source2, texel, 0 );
	return texelFetch( source3, texel, 0 );
}

void main() {
	ivec2 id = ivec2( gl_FragCoord.xy );
	vec2 invocation = vec2( id );
#ifdef MODE_SMART
	float ao;
	uvec2 pix_pos = uvec2( id );
	int mx = int( pix_pos.x % 2u );
	int my = int( pix_pos.y % 2u );
	int index_center = mx + my * 2;
	int index_horizontal = ( 1 - mx ) + my * 2;
	int index_vertical = mx + ( 1 - my ) * 2;
	int index_diagonal = ( 1 - mx ) + ( 1 - my ) * 2;

	vec2 center_val = sliceTexel( index_center, ivec2( pix_pos / uvec2( size_modifier ) ) ).xy;

	ao = center_val.x;

	vec4 edgesLRTB = unpack_edges( center_val.y );

	float fmx = float( mx );
	float fmy = float( my );

	float fmxe = ( edgesLRTB.y - edgesLRTB.x );
	float fmye = ( edgesLRTB.w - edgesLRTB.z );

	vec2 uv_horizontal = ( invocation + vec2( 0.5 ) + vec2( fmx + fmxe - 0.5, 0.5 - fmy ) ) * pixel_size;
	float ao_horizontal = sliceAt( index_horizontal, uv_horizontal ).x;
	vec2 uv_vertical = ( invocation + vec2( 0.5 ) + vec2( 0.5 - fmx, fmy - 0.5 + fmye ) ) * pixel_size;
	float ao_vertical = sliceAt( index_vertical, uv_vertical ).x;
	vec2 uv_diagonal = ( invocation + vec2( 0.5 ) + vec2( fmx - 0.5 + fmxe, fmy - 0.5 + fmye ) ) * pixel_size;
	float ao_diagonal = sliceAt( index_diagonal, uv_diagonal ).x;

	vec4 blendWeights;
	blendWeights.x = 1.0;
	blendWeights.y = ( edgesLRTB.x + edgesLRTB.y ) * 0.5;
	blendWeights.z = ( edgesLRTB.z + edgesLRTB.w ) * 0.5;
	blendWeights.w = ( blendWeights.y + blendWeights.z ) * 0.5;

	float blendWeightsSum = dot( blendWeights, vec4( 1.0, 1.0, 1.0, 1.0 ) );
	ao = dot( vec4( ao, ao_horizontal, ao_vertical, ao_diagonal ), blendWeights ) / blendWeightsSum;

	gl_FragColor = vec4( ao );
#else
	vec2 uv = ( invocation + vec2( 0.5 ) ) * pixel_size;
#ifdef MODE_HALF
	float a = sliceAt( 0, uv ).x;
	float d = sliceAt( 3, uv ).x;
	float avg = ( a + d ) * 0.5;
#else
	float a = sliceAt( 0, uv ).x;
	float b = sliceAt( 1, uv ).x;
	float c = sliceAt( 2, uv ).x;
	float d = sliceAt( 3, uv ).x;
	float avg = ( a + b + c + d ) * 0.25;
#endif
	gl_FragColor = vec4( avg );
#endif
}
`;

/**
 * The blur of `PROCESS_MAPA` or, with `PROCESS_MAPB`, of its second pass, at the texel `ssC`.
 * Godot's work groups run it at texels past the map's edge too, whose reads the sampler clamps.
 */
const PROCESSED_IMPORTANCE = /* glsl */ `
float processedImportance( ivec2 ssC ) {
	vec2 uv = ( vec2( ssC ) + 0.5 ) * half_screen_pixel_size * 2.0;

	vec2 half_pixel = half_screen_pixel_size;

	vec4 vals;
#ifdef PROCESS_MAPB
	vals.x = textureLod( source_importance, uv + vec2( -half_pixel.x, -half_pixel.y * 3.0 ), 0.0 ).x;
	vals.y = textureLod( source_importance, uv + vec2( +half_pixel.x * 3.0, -half_pixel.y ), 0.0 ).x;
	vals.z = textureLod( source_importance, uv + vec2( +half_pixel.x, +half_pixel.y * 3.0 ), 0.0 ).x;
	vals.w = textureLod( source_importance, uv + vec2( -half_pixel.x * 3.0, +half_pixel.y ), 0.0 ).x;
#else
	vals.x = textureLod( source_importance, uv + vec2( -half_pixel.x * 3.0, -half_pixel.y ), 0.0 ).x;
	vals.y = textureLod( source_importance, uv + vec2( +half_pixel.x, -half_pixel.y * 3.0 ), 0.0 ).x;
	vals.z = textureLod( source_importance, uv + vec2( +half_pixel.x * 3.0, +half_pixel.y ), 0.0 ).x;
	vals.w = textureLod( source_importance, uv + vec2( -half_pixel.x, +half_pixel.y * 3.0 ), 0.0 ).x;
#endif

	return dot( vals, vec4( 0.25, 0.25, 0.25, 0.25 ) );
}
`;

/**
 * `ssao_importance_map.glsl`, Ultra's map of where the gather spends its flexible taps:
 * `GENERATE_MAP` from the base pass's four slices, then `PROCESS_MAPA` and `PROCESS_MAPB`, each a
 * blur through the default linear sampler.
 */
export const IMPORTANCE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

#ifdef GENERATE_MAP
uniform highp sampler2D source0;
uniform highp sampler2D source1;
uniform highp sampler2D source2;
uniform highp sampler2D source3;
#else
uniform highp sampler2D source_importance;
#endif
uniform vec2 half_screen_pixel_size;
uniform float intensity;
uniform float power;

${TEXEL_SAMPLING}

#ifndef GENERATE_MAP
${PROCESSED_IMPORTANCE}
#endif

#ifdef GENERATE_MAP
vec4 gatherSlice( int i, vec2 uv ) {
	if ( i == 0 ) return gatherClamped( source0, uv );
	if ( i == 1 ) return gatherClamped( source1, uv );
	if ( i == 2 ) return gatherClamped( source2, uv );
	return gatherClamped( source3, uv );
}
#endif

void main() {
	ivec2 ssC = ivec2( gl_FragCoord.xy );

#ifdef GENERATE_MAP
	ivec2 base_position = ssC * 2;

	vec2 base_uv = ( vec2( base_position ) + vec2( 0.5, 0.5 ) ) * half_screen_pixel_size;

	float minV = 1.0;
	float maxV = 0.0;
	for ( int i = 0; i < 4; i++ ) {
		vec4 vals = gatherSlice( i, base_uv );

		vals = intensity * vals;

		vals = 1.0 - vals;

		vals = pow( clamp( vals, 0.0, 1.0 ), vec4( power ) );

		maxV = max( maxV, max( max( vals.x, vals.y ), max( vals.z, vals.w ) ) );
		minV = min( minV, min( min( vals.x, vals.y ), min( vals.z, vals.w ) ) );
	}

	float min_max_diff = maxV - minV;

	gl_FragColor = vec4( pow( clamp( min_max_diff * 2.0, 0.0, 1.0 ), 0.8 ) );
#else
	gl_FragColor = vec4( processedImportance( ssC ) );
#endif
}
`;

/**
 * `PROCESS_MAPB`'s `atomicAdd` into the load counter, as one sum: every ninth texel's blurred
 * importance, as 8 bits, over every invocation of Godot's eight-by-eight work groups, those past the
 * map's edge included. `groups` is the map's size in whole groups, times eight.
 */
export const LOAD_COUNTER_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

#define PROCESS_MAPB
uniform highp sampler2D source_importance;
uniform vec2 half_screen_pixel_size;
uniform ivec2 groups;

${PROCESSED_IMPORTANCE}

void main() {
	float sum = 0.0;
	for ( int y = 0; y < groups.y; y += 3 ) {
		for ( int x = 0; x < groups.x; x += 3 ) {
			float avg = processedImportance( ivec2( x, y ) );
			sum += float( uint( clamp( avg, 0.0, 1.0 ) * 255.0 + 0.5 ) );
		}
	}
	gl_FragColor = vec4( sum );
}
`;
