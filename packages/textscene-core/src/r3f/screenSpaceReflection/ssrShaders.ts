/**
 * The fragment shaders of Godot 4.6.3's screen-space reflection passes
 * (`servers/rendering/renderer_rd/shaders/effects/screen_space_reflection*.glsl`), each a compute
 * pass that writes one texel per invocation, drawn here as one fragment per texel. Every buffer of
 * the passes holds Godot's rows, top-down, so a ported line reads the texel it reads in Godot. Only
 * a read of the frame three drew, and the scene's read of the result, turn the rows over.
 */

/**
 * Godot's depth from a three depth texel: reversed, 1 at the near plane and 0 at the far plane and
 * the background. Godot's projection maps the same view depth to `1 - depth` (`Projection::set_depth_correction`).
 */
const GODOT_DEPTH = /* glsl */ `
float godotDepth( float threeDepth ) {
	return 1.0 - threeDepth;
}
`;

/** The texel of three's frame, whose rows run bottom-up, at Godot's pixel `pixel` of a frame `height` rows high. */
const THREE_ROW = /* glsl */ `
ivec2 threeTexel( ivec2 pixel, int height ) {
	return ivec2( pixel.x, height - 1 - pixel.y );
}
`;

/**
 * A texel fetch that reads zero outside the texture, as Vulkan's robust image access does where a
 * pass of Godot's reads past an edge. WebGL leaves such a fetch undefined.
 */
const FETCH_OR_ZERO = /* glsl */ `
vec4 fetchOrZero( highp sampler2D source, ivec2 texel, int level ) {
	ivec2 size = textureSize( source, level );
	if ( any( lessThan( texel, ivec2( 0 ) ) ) || any( greaterThanEqual( texel, size ) ) ) return vec4( 0.0 );
	return texelFetch( source, texel, level );
}
`;

/** Folds Godot's dynamic flag out of a stored roughness (`screen_space_reflection.glsl:114-118`). */
const STORED_ROUGHNESS = /* glsl */ `
float storedRoughness( float stored ) {
	float roughness = stored;
	if ( roughness > 0.5 ) {
		roughness = 1.0 - roughness;
	}
	return roughness / ( 127.0 / 255.0 );
}
`;

/** The Rec. 709 luminance the trace tone maps a reflection by, and the resolve undoes it by. */
const REC709_LUMINANCE = 'const vec3 rec709_luminance_weights = vec3( 0.2126, 0.7152, 0.0722 );';

/**
 * The frame's depth and normal and roughness from its samples, as Godot resolves a multisampled
 * prepass (`effects/resolve.glsl`, `MODE_RESOLVE_GI`): both of the one sample the rule below picks,
 * in three's rows and depth. Sample `i` is drawn into `depth<i>` and `normalRoughness<i>`, since
 * WebGL reads no multisampled texture. One draw writes both, one to each attachment.
 */
export function sampleResolveFragment(samples: number): string {
  const indices = Array.from({ length: samples }, (_, index) => index);
  const declarations = indices
    .map((i) => `uniform highp sampler2D depth${i};\nuniform highp sampler2D normalRoughness${i};`)
    .join('\n');
  const depthReads = indices
    .map((i) => `if ( i == ${i} ) return texelFetch( depth${i}, pixel, 0 ).x;`)
    .join('\n\t');
  const normalReads = indices
    .map((i) => `if ( i == ${i} ) return texelFetch( normalRoughness${i}, pixel, 0 );`)
    .join('\n\t');
  return /* glsl */ `
#define SAMPLES ${samples}
${declarations}
${GODOT_DEPTH}
layout( location = 0 ) out highp vec4 resolvedDepth;
layout( location = 1 ) out highp vec4 resolvedNormalRoughness;

float threeDepthOf( int i, ivec2 pixel ) {
	${depthReads}
	return 1.0;
}

vec4 normalRoughnessOf( int i, ivec2 pixel ) {
	${normalReads}
	return vec4( 0.0 );
}

// Two samples keep the one nearer the camera. Four or eight keep the depth fewest samples share,
// the first of a tie, from each group of four, and of eight Godot's \`mix( best_index0,
// best_index1, min_f0 < min_f1 )\` keeps the second group's when the first group's count is lower.
int bestSample( ivec2 pixel ) {
	float depths[ SAMPLES ];
	for ( int i = 0; i < SAMPLES; i ++ ) depths[ i ] = godotDepth( threeDepthOf( i, pixel ) );
#if SAMPLES == 2
	return depths[ 0 ] < depths[ 1 ] ? 1 : 0;
#elif SAMPLES == 4 || SAMPLES == 8
	int best[ 2 ] = int[ 2 ]( 0, 4 );
	float least[ 2 ] = float[ 2 ]( 1e20, 1e20 );
	for ( int group = 0; group < SAMPLES / 4; group ++ ) {
		for ( int i = group * 4; i < group * 4 + 4; i ++ ) {
			float frequency = 0.0;
			for ( int j = 0; j < SAMPLES; j ++ ) frequency += depths[ i ] == depths[ j ] ? 1.0 : 0.0;
			if ( frequency < least[ group ] ) {
				least[ group ] = frequency;
				best[ group ] = i;
			}
		}
	}
#if SAMPLES == 4
	return best[ 0 ];
#else
	return least[ 0 ] < least[ 1 ] ? best[ 1 ] : best[ 0 ];
#endif
#else
	return 0;
#endif
}

void main() {
	ivec2 pixel = ivec2( gl_FragCoord.xy );
	int best = bestSample( pixel );
	resolvedDepth = vec4( threeDepthOf( best, pixel ), 0.0, 0.0, 0.0 );
	resolvedNormalRoughness = normalRoughnessOf( best, pixel );
}
`;
}

/** The base of the depth pyramid at full size: three's depth as Godot's (`ss_effects.cpp:1553-1561`). */
export const DEPTH_COPY_FRAGMENT = /* glsl */ `
uniform highp sampler2D depth;
${GODOT_DEPTH}
${THREE_ROW}
void main() {
	ivec2 pixel = ivec2( gl_FragCoord.xy );
	int height = textureSize( depth, 0 ).y;
	gl_FragColor = vec4( godotDepth( texelFetch( depth, threeTexel( pixel, height ), 0 ).x ), 0.0, 0.0, 0.0 );
}
`;

/**
 * The half-size base of the depth pyramid, and the normal and roughness of the sample nearest the
 * camera (`screen_space_reflection_downsample.glsl`). An odd side also reads the third texel along
 * it. `writesNormal` picks the output: the R32F depth and the RGBA8 normal draw apart.
 */
export const DOWNSAMPLE_FRAGMENT = /* glsl */ `
uniform highp sampler2D depth;
uniform highp sampler2D normalRoughness;
uniform bool writesNormal;
${GODOT_DEPTH}
${THREE_ROW}
int sourceHeight;

float sourceDepth( ivec2 pixel ) {
	return godotDepth( texelFetch( depth, threeTexel( pixel, sourceHeight ), 0 ).x );
}

void get_sample( ivec2 sample_pos, inout float depth, inout ivec2 winner_sample_pos ) {
	float sample_depth = sourceDepth( sample_pos );
	if ( depth < sample_depth ) {
		depth = sample_depth;
		winner_sample_pos = sample_pos;
	}
}

void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy );
	ivec2 sourceSize = textureSize( depth, 0 );
	sourceHeight = sourceSize.y;
	bool isWidthOdd = sourceSize.x % 2 != 0;
	bool isHeightOdd = sourceSize.y % 2 != 0;

	ivec2 sample_pos = pixel_pos * 2 + ivec2( 0, 0 );
	float depth = sourceDepth( sample_pos );

	get_sample( pixel_pos * 2 + ivec2( 1, 0 ), depth, sample_pos );
	get_sample( pixel_pos * 2 + ivec2( 0, 1 ), depth, sample_pos );
	get_sample( pixel_pos * 2 + ivec2( 1, 1 ), depth, sample_pos );

	if ( isWidthOdd ) {
		get_sample( pixel_pos * 2 + ivec2( 2, 0 ), depth, sample_pos );
		get_sample( pixel_pos * 2 + ivec2( 2, 1 ), depth, sample_pos );
	}

	if ( isHeightOdd ) {
		get_sample( pixel_pos * 2 + ivec2( 0, 2 ), depth, sample_pos );
		get_sample( pixel_pos * 2 + ivec2( 1, 2 ), depth, sample_pos );
	}

	if ( isWidthOdd && isHeightOdd ) {
		get_sample( pixel_pos * 2 + ivec2( 2, 2 ), depth, sample_pos );
	}

	gl_FragColor = writesNormal ? texelFetch( normalRoughness, threeTexel( sample_pos, sourceHeight ), 0 ) : vec4( depth, 0.0, 0.0, 0.0 );
}
`;

/**
 * One level of the depth pyramid from the level before, the depth nearest the camera of each 2 x 2
 * block, and of the third texel along an odd side (`screen_space_reflection_hiz.glsl`).
 */
export const HIZ_FRAGMENT = /* glsl */ `
uniform highp sampler2D pyramid;
uniform int sourceLevel;

float source( ivec2 texel ) {
	return texelFetch( pyramid, texel, sourceLevel ).x;
}

void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy );
	ivec2 parentSize = textureSize( pyramid, sourceLevel );
	bool isWidthOdd = parentSize.x % 2 != 0;
	bool isHeightOdd = parentSize.y % 2 != 0;

	float depth = source( pixel_pos * 2 + ivec2( 0, 0 ) );
	depth = max( depth, source( pixel_pos * 2 + ivec2( 1, 0 ) ) );
	depth = max( depth, source( pixel_pos * 2 + ivec2( 0, 1 ) ) );
	depth = max( depth, source( pixel_pos * 2 + ivec2( 1, 1 ) ) );

	if ( isWidthOdd ) {
		depth = max( depth, source( pixel_pos * 2 + ivec2( 2, 0 ) ) );
		depth = max( depth, source( pixel_pos * 2 + ivec2( 2, 1 ) ) );
	}

	if ( isHeightOdd ) {
		depth = max( depth, source( pixel_pos * 2 + ivec2( 0, 2 ) ) );
		depth = max( depth, source( pixel_pos * 2 + ivec2( 1, 2 ) ) );
	}

	if ( isWidthOdd && isHeightOdd ) {
		depth = max( depth, source( pixel_pos * 2 + ivec2( 2, 2 ) ) );
	}

	gl_FragColor = vec4( depth, 0.0, 0.0, 0.0 );
}
`;

/**
 * The roughness range over which the scene fades a reflection out (`scene_forward_clustered.glsl:2204`).
 * The trace draws none from its end.
 */
export const ROUGHNESS_FADE = { start: 0.6, end: 0.7 } as const;

/**
 * The trace (`screen_space_reflection.glsl`, cited as `:N`): from each smooth pixel, a ray along the
 * reflection through the depth pyramid, which reads the last frame where it hits, faded by its
 * screen length, its confidence and the screen's margin, and tone mapped. It writes the colour, and
 * the mip the roughness filter reads, quantised as Godot's R8 store keeps it.
 */
export const TRACE_FRAGMENT = /* glsl */ `
uniform highp sampler2D source_last_frame;
uniform highp sampler2D source_hiz;
uniform highp sampler2D source_normal_roughness;
uniform mat4 projection;
uniform mat4 inv_projection;
uniform mat4 reprojection;
uniform int mipmaps;
uniform int num_steps;
uniform float distance_fade;
uniform float curve_fade_in;
uniform float depth_tolerance;
uniform bool orthogonal;

layout( location = 0 ) out highp vec4 output_color;
layout( location = 1 ) out highp vec4 output_mip_level;

${FETCH_OR_ZERO}
${STORED_ROUGHNESS}

ivec2 screen_size;

vec2 compute_cell_count( int level ) {
	int cell_count_x = max( 1, screen_size.x >> level );
	int cell_count_y = max( 1, screen_size.y >> level );
	return vec2( cell_count_x, cell_count_y );
}

float linearize_depth( float depth ) {
	vec4 pos = vec4( 0.0, 0.0, depth, 1.0 );
	pos = inv_projection * pos;
	return pos.z / pos.w;
}

vec3 compute_view_pos( vec3 screen_pos ) {
	vec4 pos;
	pos.xy = screen_pos.xy * 2.0 - 1.0;
	pos.z = screen_pos.z;
	pos.w = 1.0;
	pos = inv_projection * pos;
	return pos.xyz / pos.w;
}

vec3 compute_screen_pos( vec3 pos ) {
	vec4 screen_pos = projection * vec4( pos, 1.0 );
	screen_pos.xyz /= screen_pos.w;
	screen_pos.xy = screen_pos.xy * 0.5 + 0.5;
	return screen_pos.xyz;
}

float hiz( ivec2 texel ) {
	return fetchOrZero( source_hiz, texel, 0 ).x;
}

// https://habr.com/ru/articles/744336/ (:64-90)
vec3 compute_geometric_normal( ivec2 pixel_pos, float depth_c, vec3 view_c, float pixel_offset ) {
	vec4 H = vec4( hiz( pixel_pos + ivec2( - 1, 0 ) ), hiz( pixel_pos + ivec2( - 2, 0 ) ), hiz( pixel_pos + ivec2( 1, 0 ) ), hiz( pixel_pos + ivec2( 2, 0 ) ) );
	vec4 V = vec4( hiz( pixel_pos + ivec2( 0, - 1 ) ), hiz( pixel_pos + ivec2( 0, - 2 ) ), hiz( pixel_pos + ivec2( 0, 1 ) ), hiz( pixel_pos + ivec2( 0, 2 ) ) );

	vec2 he = abs( ( 2.0 * H.xz - H.yw ) - depth_c );
	vec2 ve = abs( ( 2.0 * V.xz - V.yw ) - depth_c );

	int h_sign = he.x < he.y ? - 1 : 1;
	int v_sign = ve.x < ve.y ? - 1 : 1;

	vec3 view_h = compute_view_pos( vec3( ( vec2( pixel_pos ) + vec2( h_sign, 0 ) + pixel_offset ) / vec2( screen_size ), H[ 1 + h_sign ] ) );
	vec3 view_v = compute_view_pos( vec3( ( vec2( pixel_pos ) + vec2( 0, v_sign ) + pixel_offset ) / vec2( screen_size ), V[ 1 + v_sign ] ) );

	vec3 h_der = float( h_sign ) * ( view_h - view_c );
	vec3 v_der = float( v_sign ) * ( view_v - view_c );

	return cross( v_der, h_der );
}

#define M_PI 3.14159265359

void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy );
	screen_size = textureSize( source_hiz, 0 );

	vec4 color = vec4( 0.0 );
	float mip_level = 0.0;

	vec3 screen_pos;
	screen_pos.xy = ( vec2( pixel_pos ) + 0.5 ) / vec2( screen_size );
	screen_pos.z = texelFetch( source_hiz, pixel_pos, 0 ).x;

	bool should_trace = screen_pos.z != 0.0;
	if ( should_trace ) {
		vec3 pos = compute_view_pos( screen_pos );

		vec4 normal_roughness = texelFetch( source_normal_roughness, pixel_pos, 0 );
		vec3 normal = normalize( normal_roughness.xyz * 2.0 - 1.0 );
		float roughness = storedRoughness( normal_roughness.w );

		// :120-126
		if ( roughness >= ${ROUGHNESS_FADE.end} ) {
			output_color = vec4( 0.0 );
			output_mip_level = vec4( 0.0 );
			return;
		}

		vec3 geom_normal = normalize( compute_geometric_normal( pixel_pos, screen_pos.z, pos, 0.5 ) );

		// A small bias towards the geometry normal prevents self intersections (:130-132).
		pos += geom_normal * ( 1.0 - pow( clamp( dot( normal, geom_normal ), 0.0, 1.0 ), 8.0 ) );
		screen_pos = compute_screen_pos( pos );

		vec3 view_dir = orthogonal ? vec3( 0.0, 0.0, - 1.0 ) : normalize( pos );
		vec3 ray_dir = normalize( reflect( view_dir, normal ) );

		// A ray that enters its own surface bounces off the geometry (:137-140).
		if ( dot( ray_dir, geom_normal ) < 0.0 ) {
			ray_dir = normalize( reflect( ray_dir, geom_normal ) );
		}

		vec3 end_pos = pos + ray_dir;

		// Clipped to the near plane, with a small bias so it never reaches infinity (:144-147).
		if ( end_pos.z > 0.0 ) {
			end_pos -= ray_dir / ray_dir.z * ( end_pos.z + 0.00001 );
		}

		vec3 screen_end_pos = compute_screen_pos( end_pos );

		// Z normalised to -1 or +1, and traced by a parameter t (:151-154).
		vec3 screen_ray_dir = screen_end_pos - screen_pos;
		screen_ray_dir /= abs( screen_ray_dir.z );

		bool facing_camera = screen_ray_dir.z >= 0.0;

		// The screen edge where the trace stops (:158-162).
		vec2 t0 = ( vec2( 0.0 ) - screen_pos.xy ) / screen_ray_dir.xy;
		vec2 t1 = ( vec2( 1.0 ) - screen_pos.xy ) / screen_ray_dir.xy;
		vec2 t2 = max( t0, t1 );
		float t_max = min( t2.x, t2.y );

		vec2 cell_step = vec2( screen_ray_dir.x < 0.0 ? - 1.0 : 1.0, screen_ray_dir.y < 0.0 ? - 1.0 : 1.0 );

		int cur_level = 0;
		int cur_iteration = num_steps;

		// The start moves to the next cell, so the ray never hits its own (:169-179).
		float t;
		{
			vec2 cell_index = floor( screen_pos.xy * vec2( screen_size ) );
			vec2 new_cell_index = cell_index + clamp( cell_step, vec2( 0.0 ), vec2( 1.0 ) );
			vec2 new_cell_pos = ( new_cell_index / vec2( screen_size ) ) + cell_step * 0.000001;
			vec2 pos_t = ( new_cell_pos - screen_pos.xy ) / screen_ray_dir.xy;
			float edge_t = min( pos_t.x, pos_t.y );

			t = edge_t;
		}

		while ( cur_level >= 0 && cur_iteration > 0 && t < t_max ) {
			vec3 cur_screen_pos = screen_pos + screen_ray_dir * t;

			vec2 cell_count = compute_cell_count( cur_level );
			vec2 cell_index = floor( cur_screen_pos.xy * cell_count );
			float cell_depth = texelFetch( source_hiz, ivec2( cell_index ), cur_level ).x;
			float depth_t = ( cell_depth - screen_pos.z ) * screen_ray_dir.z;

			vec2 new_cell_index = cell_index + clamp( cell_step, vec2( 0.0 ), vec2( 1.0 ) );
			vec2 new_cell_pos = ( new_cell_index / cell_count ) + cell_step * 0.000001;
			vec2 pos_t = ( new_cell_pos - screen_pos.xy ) / screen_ray_dir.xy;
			float edge_t = min( pos_t.x, pos_t.y );

			bool hit = facing_camera ? ( t <= depth_t ) : ( depth_t <= edge_t );
			int mip_offset = hit ? - 1 : + 1;

			if ( cur_level == 0 ) {
				float z0 = linearize_depth( cell_depth );
				float z1 = linearize_depth( cur_screen_pos.z );

				if ( ( z0 - z1 ) > depth_tolerance ) {
					hit = false;
					// The level stays, so it never falls and climbs back in turn (:203).
					mip_offset = 0;
				}
			}

			if ( hit ) {
				if ( ! facing_camera ) {
					t = max( t, depth_t );
				}
			} else {
				t = edge_t;
			}

			cur_level = min( cur_level + mip_offset, mipmaps - 1 );
			-- cur_iteration;
		}

		vec3 cur_screen_pos = screen_pos + screen_ray_dir * t;

		vec4 reprojected_pos;
		reprojected_pos.xy = cur_screen_pos.xy * 2.0 - 1.0;
		reprojected_pos.z = cur_screen_pos.z;
		reprojected_pos.w = 1.0;
		reprojected_pos = reprojection * reprojected_pos;
		reprojected_pos.xy = reprojected_pos.xy / reprojected_pos.w * 0.5 + 0.5;

		// Validity in the alpha rather than a hard rejection, so an invalid sample still writes a mip (:228-230).
		float validity = 1.0;

		ivec2 cur_pixel_pos = ivec2( cur_screen_pos.xy * vec2( screen_size ) );

		float hit_depth = hiz( cur_pixel_pos );
		if ( t >= t_max || hit_depth == 0.0 ) {
			validity = 0.0;
		}

		if ( all( lessThan( abs( screen_ray_dir.xy * t ), 2.0 / vec2( screen_size ) ) ) ) {
			vec3 hit_normal = fetchOrZero( source_normal_roughness, cur_pixel_pos, 0 ).xyz * 2.0 - 1.0;
			if ( dot( ray_dir, hit_normal ) >= 0.0 ) {
				validity = 0.0;
			}
		}

		vec3 cur_pos = compute_view_pos( cur_screen_pos );
		vec3 hit_pos = compute_view_pos( vec3( cur_screen_pos.xy, hit_depth ) );

		float delta = length( cur_pos - hit_pos );
		float confidence = 1.0 - smoothstep( 0.0, depth_tolerance, delta );
		validity *= clamp( confidence * confidence, 0.0, 1.0 );

		float margin_blend = 1.0;
		vec2 reprojected_pixel_pos = reprojected_pos.xy * vec2( screen_size );

		vec2 margin = vec2( float( screen_size.x + screen_size.y ) * 0.05 );
		{
			// Fades towards the inner margin, from the middle of the reflection (:261-265).
			vec2 margin_grad = mix( vec2( screen_size ) - reprojected_pixel_pos, reprojected_pixel_pos, lessThan( reprojected_pixel_pos, vec2( screen_size ) * 0.5 ) );
			margin_blend = smoothstep( 0.0, margin.x * margin.y, margin_grad.x * margin_grad.y );
		}

		float ray_len = length( screen_ray_dir.xy * t );

		// :270-273
		float grad = ray_len;
		float fade_in = curve_fade_in == 0.0 ? 1.0 : pow( clamp( grad, 0.0, 1.0 ), curve_fade_in );
		float fade_out = distance_fade == 0.0 ? 1.0 : pow( clamp( 1.0 - grad, 0.0, 1.0 ), distance_fade );
		float fade = fade_in * fade_out;

		// A fade just below 1 would let a strong specular leak through the reflection (:275-279).
		if ( fade > 0.999 ) {
			fade = 1.0;
		}

		validity *= fade * margin_blend;

		if ( validity > 0.0 ) {
			color = vec4( textureLod( source_last_frame, reprojected_pos.xy, 0.0 ).xyz, 1.0 ) * validity;

			// Tone mapped, so the roughness filter mixes samples of unlike luminance smoothly (:286-288).
			${REC709_LUMINANCE}
			color.rgb /= 1.0 + dot( color.rgb, rec709_luminance_weights );
		}

		if ( roughness > 0.001 ) {
			float cone_angle = min( roughness, 0.999 ) * M_PI * 0.5;
			float cone_len = ray_len;
			float op_len = 2.0 * tan( cone_angle ) * cone_len;
			float blur_radius;
			{
				// The sphere inside the cone, ending where it ends (:297-309).
				float a = op_len;
				float h = cone_len;
				float a2 = a * a;
				float fh2 = 4.0 * h * h;
				blur_radius = ( a * ( sqrt( a2 + fh2 ) - a ) ) / ( 4.0 * h );
			}

			mip_level = clamp( log2( blur_radius * float( max( screen_size.x, screen_size.y ) ) / 16.0 ), 0.0, float( mipmaps - 1 ) );
		}

		// The mip fades near the end of the ray, where invalid samples would build a pyramid (:314-317).
		mip_level *= pow( clamp( 1.25 - ray_len, 0.0, 1.0 ), 0.2 );
	}

	output_color = color;
	output_mip_level = vec4( round( clamp( mip_level / 14.0, 0.0, 1.0 ) * 255.0 ) / 255.0, 0.0, 0.0, 0.0 );
}
`;

/** Gaussian weights of the roughness filter (`screen_space_reflection_filter.glsl:20-27`). */
const FILTER_WEIGHTS = `0.07130343198685299, 0.1315141208431224, 0.18987923288883812, 0.21460642856237303,
	0.18987923288883812, 0.1315141208431224, 0.07130343198685299`;

/** The taps on each side of the roughness filter's centre. */
export const FILTER_RADIUS = 3;

const FILTER_TAPS = 2 * FILTER_RADIUS + 1;

/** Each tap weighted by its validity, more so at a deeper mip (`screen_space_reflection_filter.glsl:29-31`). */
const FILTER_TAP_WEIGHT = /* glsl */ `
uniform int mip_level;

const float WEIGHTS[ ${FILTER_TAPS} ] = float[ ${FILTER_TAPS} ]( ${FILTER_WEIGHTS} );

float get_weight( vec4 c ) {
	return mix( clamp( float( mip_level ) * 0.2, 0.0, 1.0 ), 1.0, c.a );
}
`;

/**
 * The first half of one level of the reflection's roughness chain (`screen_space_reflection_filter.glsl`):
 * the level before, read bilinearly at this level's texels, then blurred by a 7-tap gaussian across.
 * Godot caches and blurs the rows past each edge from the clamped read there, so this pass draws
 * those rows too, row `y` at row `y + FILTER_RADIUS`.
 */
export const FILTER_ACROSS_FRAGMENT = /* glsl */ `
uniform highp sampler2D chain;
${FILTER_TAP_WEIGHT}
ivec2 screen_size;

vec4 get_sample( ivec2 pixel_pos ) {
	return textureLod( chain, ( vec2( pixel_pos ) + 0.5 ) / vec2( screen_size ), float( mip_level - 1 ) );
}

void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy ) - ivec2( 0, ${FILTER_RADIUS} );
	screen_size = max( textureSize( chain, 0 ) >> mip_level, ivec2( 1 ) );

	vec4 c = vec4( 0.0 );
	float w = 0.0;
	for ( int i = 0; i < ${FILTER_TAPS}; i ++ ) {
		vec4 tap = get_sample( pixel_pos + ivec2( i - ${FILTER_RADIUS}, 0 ) );
		float tap_weight = WEIGHTS[ i ] * get_weight( tap );
		c += tap * tap_weight;
		w += tap_weight;
	}
	gl_FragColor = w > 0.0 ? c / w : vec4( 0.0 );
}
`;

/**
 * The second half: the blur across, blurred by the same gaussian down (`:68-101`). Two passes of 7
 * taps, where one pass would read 49 texels of the level before for each texel.
 */
export const FILTER_DOWN_FRAGMENT = /* glsl */ `
uniform highp sampler2D across;
${FILTER_TAP_WEIGHT}
void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy );

	vec4 c = vec4( 0.0 );
	float w = 0.0;
	for ( int i = 0; i < ${FILTER_TAPS}; i ++ ) {
		vec4 tap = texelFetch( across, pixel_pos + ivec2( 0, i ), 0 );
		float tap_weight = WEIGHTS[ i ] * get_weight( tap );
		c += tap * tap_weight;
		w += tap_weight;
	}
	gl_FragColor = w > 0.0 ? c / w : vec4( 0.0 );
}
`;

/**
 * A stored roughness from which the scene's own roughness is past the fade's end. A stored roughness
 * is the scene's within half a step of its 127, so one whole step past the end clears it.
 */
const SHOWN_ROUGHNESS_LIMIT = `( ${ROUGHNESS_FADE.end} + 1.0 / 127.0 )`;

/**
 * The half-size reflection at full size (`screen_space_reflection_resolve.glsl`): the four nearest
 * half-size texels at their filtered mip, the tone map undone, weighted by how close each one's
 * depth, normal and roughness come to this pixel's, and bilinearly. With `SKIPS_UNREFLECTED`, a
 * pixel the scene shows no reflection at, on the background or past the fade, reads zero. Only a
 * frame of one sample defines it: a pixel of several shows the reflection of every sample's surface.
 */
export const RESOLVE_FRAGMENT = /* glsl */ `
uniform highp sampler2D source_depth;
uniform highp sampler2D source_normal_roughness;
uniform highp sampler2D source_depth_half;
uniform highp sampler2D source_normal_roughness_half;
uniform highp sampler2D source_color;
uniform highp sampler2D source_mip_level;

${GODOT_DEPTH}
${THREE_ROW}
${FETCH_OR_ZERO}
${STORED_ROUGHNESS}

ivec2 screen_size;

void get_sample( float depth, vec3 normal, float roughness, ivec2 pixel_pos, out vec4 color, out float weight ) {
	float sample_depth = fetchOrZero( source_depth_half, pixel_pos, 0 ).x;
	vec4 sample_normal_roughness = fetchOrZero( source_normal_roughness_half, pixel_pos, 0 );
	vec3 sample_normal = normalize( sample_normal_roughness.xyz * 2.0 - 1.0 );
	float sample_roughness = storedRoughness( sample_normal_roughness.w );

	vec2 uv = ( vec2( pixel_pos ) + 0.5 ) / ( vec2( screen_size ) * 0.5 );

	float mip_level = fetchOrZero( source_mip_level, pixel_pos, 0 ).x * 14.0;
	color = textureLod( source_color, uv, mip_level );

	// The tone map of the trace, undone (:167-169).
	${REC709_LUMINANCE}
	color.rgb /= 1.0 - dot( color.rgb, rec709_luminance_weights );

	const float DEPTH_FACTOR = 2048.0;
	const float NORMAL_FACTOR = 32.0;
	const float ROUGHNESS_FACTOR = 16.0;

	float depth_diff = abs( depth - sample_depth );
	float weight_depth = exp( - depth_diff * DEPTH_FACTOR );

	float normal_diff = clamp( 1.0 - dot( normal, sample_normal ), 0.0, 1.0 );
	float weight_normal = exp( - normal_diff * NORMAL_FACTOR );

	float roughness_diff = abs( roughness - sample_roughness );
	float weight_roughness = exp( - roughness_diff * ROUGHNESS_FACTOR );

	weight = weight_depth * weight_normal * weight_roughness;
}

void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy );
	screen_size = textureSize( source_depth, 0 );
	ivec2 threePixel = threeTexel( pixel_pos, screen_size.y );

	float depth = godotDepth( texelFetch( source_depth, threePixel, 0 ).x );
	vec4 normal_roughness = texelFetch( source_normal_roughness, threePixel, 0 );
	vec3 normal = normalize( normal_roughness.xyz * 2.0 - 1.0 );
	float roughness = storedRoughness( normal_roughness.w );

	#ifdef SKIPS_UNREFLECTED
		if ( depth == 0.0 || roughness >= ${SHOWN_ROUGHNESS_LIMIT} ) {
			gl_FragColor = vec4( 0.0 );
			return;
		}
	#endif

	vec2 half_tex_coord = ( vec2( pixel_pos ) + 0.5 ) * 0.5;
	vec2 bilinear_weights = fract( half_tex_coord );

	// Godot's integer division truncates towards zero, so pixel 0 starts at half texel 0.
	ivec2 base = ivec2( trunc( vec2( pixel_pos - 1 ) / 2.0 ) );

	vec4 color0, color1, color2, color3;
	float weight0, weight1, weight2, weight3;

	get_sample( depth, normal, roughness, base + ivec2( 0, 0 ), color0, weight0 );
	get_sample( depth, normal, roughness, base + ivec2( 1, 0 ), color1, weight1 );
	get_sample( depth, normal, roughness, base + ivec2( 0, 1 ), color2, weight2 );
	get_sample( depth, normal, roughness, base + ivec2( 1, 1 ), color3, weight3 );

	weight0 *= bilinear_weights.x * bilinear_weights.y;
	weight1 *= ( 1.0 - bilinear_weights.x ) * bilinear_weights.y;
	weight2 *= bilinear_weights.x * ( 1.0 - bilinear_weights.y );
	weight3 *= ( 1.0 - bilinear_weights.x ) * ( 1.0 - bilinear_weights.y );

	vec4 result_color = color0 * weight0 + color1 * weight1 + color2 * weight2 + color3 * weight3;
	float result_weight = weight0 + weight1 + weight2 + weight3;
	gl_FragColor = result_weight > 0.0 ? result_color / result_weight : vec4( 0.0 );
}
`;

/**
 * The full-size reflection as the scene reads it with no resolve: the chain at the pixel's filtered
 * mip, the tone map of the trace undone (`scene_forward_clustered.glsl:2181-2202`).
 */
export const FULL_SIZE_FRAGMENT = /* glsl */ `
uniform highp sampler2D source_color;
uniform highp sampler2D source_mip_level;

void main() {
	ivec2 pixel_pos = ivec2( gl_FragCoord.xy );
	vec2 screen_uv = ( vec2( pixel_pos ) + 0.5 ) / vec2( textureSize( source_mip_level, 0 ) );
	float ssr_mip_level = texelFetch( source_mip_level, pixel_pos, 0 ).x * 14.0;
	vec4 ssr = textureLod( source_color, screen_uv, ssr_mip_level );
	${REC709_LUMINANCE}
	ssr.rgb /= 1.0 - dot( ssr.rgb, rec709_luminance_weights );
	gl_FragColor = ssr;
}
`;

/**
 * The colour of the frame, after its alpha pass, as the next frame's trace reads it
 * (`render_forward_clustered.cpp:2413-2417`, `ss_effects.cpp:398-419`): copied at full size, or each 2 x 2 block's mean at half size
 * (`copy.glsl:82-94`). An infinite or undefined channel reads 100 (`copy.glsl:233-236`).
 */
export const LAST_FRAME_FRAGMENT = /* glsl */ `
uniform highp sampler2D frame;
uniform int blockSize;
${THREE_ROW}

vec4 sanitized( vec4 color ) {
	color = mix( color, vec4( 100.0, 100.0, 100.0, 1.0 ), isinf( color ) );
	return mix( color, vec4( 100.0, 100.0, 100.0, 1.0 ), isnan( color ) );
}

vec4 frameTexel( ivec2 pixel ) {
	return texelFetch( frame, threeTexel( pixel, textureSize( frame, 0 ).y ), 0 );
}

void main() {
	ivec2 pos = ivec2( gl_FragCoord.xy );
	if ( blockSize == 1 ) {
		gl_FragColor = sanitized( frameTexel( pos ) );
		return;
	}
	ivec2 base_pos = pos * 2;
	vec4 color = frameTexel( base_pos );
	color += frameTexel( base_pos + ivec2( 0, 1 ) );
	color += frameTexel( base_pos + ivec2( 1, 0 ) );
	color += frameTexel( base_pos + ivec2( 1, 1 ) );
	color /= 4.0;
	gl_FragColor = sanitized( color );
}
`;
