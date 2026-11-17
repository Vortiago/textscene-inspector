import { ALPHA_ANTIALIASING, DISTANCE_FADE, TRANSPARENCY, type MaterialKey } from './materialKey.js';
import { isAlphaTested } from './renderModes.js';
import { read, readOn } from './textureReads.js';

/** Each detail blend's text. Godot writes none for premultiplied alpha, which leaves `detail` undeclared. */
const DETAIL_BLENDS = [
  `
	// Detail Blend Mode: Mix
	vec3 detail = mix(ALBEDO.rgb, detail_tex.rgb, detail_tex.a);
`,
  `
	// Detail Blend Mode: Add
	vec3 detail = mix(ALBEDO.rgb, ALBEDO.rgb + detail_tex.rgb, detail_tex.a);
`,
  `
	// Detail Blend Mode: Subtract
	vec3 detail = mix(ALBEDO.rgb, ALBEDO.rgb - detail_tex.rgb, detail_tex.a);
`,
  `
	// Detail Blend Mode: Multiply
	vec3 detail = mix(ALBEDO.rgb, ALBEDO.rgb * detail_tex.rgb, detail_tex.a);
`,
];

const PROXIMITY_FADE = `
	// Proximity Fade: Enabled
	float proximity_depth_tex = textureLod(depth_texture, SCREEN_UV, 0.0).r;
	vec4 ndc = OUTPUT_IS_SRGB ? vec4(vec3(SCREEN_UV, proximity_depth_tex) * 2.0 - 1.0, 1.0) : vec4(SCREEN_UV * 2.0 - 1.0, proximity_depth_tex, 1.0);
	vec4 proximity_view_pos = INV_PROJECTION_MATRIX * ndc;
	proximity_view_pos.xyz /= proximity_view_pos.w;
	ALPHA *= clamp(1.0 - smoothstep(proximity_view_pos.z + proximity_fade_distance, proximity_view_pos.z, VERTEX.z), 0.0, 1.0);
`;

/** The part of `fragment()` after the emission: alpha, fades, and the lighting features. */
export function fragmentEffects(key: MaterialKey): string {
  let code = refractionOrAlpha(key);
  code += alphaTest(key);
  if (key.proximityFade) code += PROXIMITY_FADE;
  code += distanceFade(key);
  code += surfaceLayers(key);
  code += scattering(key);
  code += detail(key);
  return code;
}

function refractionOrAlpha(key: MaterialKey): string {
  if (key.features.has('REFRACTION')) return refraction(key);
  const isAlpha =
    key.transparency !== TRANSPARENCY.DISABLED ||
    key.flags.has('USE_SHADOW_TO_OPACITY') ||
    key.distanceFade === DISTANCE_FADE.PIXEL_ALPHA ||
    key.proximityFade;
  return isAlpha ? '	ALPHA *= albedo.a * albedo_tex.a;\n' : '';
}

function refraction(key: MaterialKey): string {
  let code = key.features.has('NORMAL_MAPPING')
    ? `
	// Refraction: Enabled (with normal map texture)
	vec3 unpacked_normal = NORMAL_MAP;
	unpacked_normal.xy = unpacked_normal.xy * 2.0 - 1.0;
	unpacked_normal.z = sqrt(max(0.0, 1.0 - dot(unpacked_normal.xy, unpacked_normal.xy)));
	vec3 ref_normal = normalize(mix(
			NORMAL,
			TANGENT * unpacked_normal.x + BINORMAL * unpacked_normal.y + NORMAL * unpacked_normal.z,
			NORMAL_MAP_DEPTH));
`
    : `
	// Refraction: Enabled
	vec3 ref_normal = NORMAL;
`;
  code += `	vec2 ref_ofs = SCREEN_UV - ref_normal.xy * dot(${read(key, 'texture_refraction')}, refraction_texture_channel) * refraction;\n`;
  return `${code}
	float ref_amount = 1.0 - albedo.a * albedo_tex.a;

	float refraction_depth_tex = textureLod(depth_texture, ref_ofs, 0.0).r;
	vec4 ndc = OUTPUT_IS_SRGB ? vec4(vec3(SCREEN_UV, refraction_depth_tex) * 2.0 - 1.0, 1.0) : vec4(SCREEN_UV * 2.0 - 1.0, refraction_depth_tex, 1.0);
	vec4 refraction_view_pos = INV_PROJECTION_MATRIX * ndc;
	refraction_view_pos.xyz /= refraction_view_pos.w;

	// If the depth buffer is lower then the model's Z position, use the refracted UV, otherwise use the normal screen UV.
	// At low depth differences, decrease refraction intensity to avoid sudden discontinuities.
	EMISSION += textureLod(screen_texture, mix(SCREEN_UV, ref_ofs, smoothstep(0.0, 1.0, VERTEX.z - refraction_view_pos.z)), ROUGHNESS * 8.0).rgb * ref_amount * EXPOSURE;
	ALBEDO *= 1.0 - ref_amount;
	// Force transparency on the material (required for refraction).
	ALPHA = 1.0;
`;
}

function alphaTest(key: MaterialKey): string {
  let code = '';
  if (key.transparency === TRANSPARENCY.ALPHA_HASH) code += '	ALPHA_HASH_SCALE = alpha_hash_scale;\n';
  else if (key.transparency === TRANSPARENCY.ALPHA_SCISSOR)
    code += '	ALPHA_SCISSOR_THRESHOLD = alpha_scissor_threshold;\n';
  if (key.alphaAntialiasingMode !== ALPHA_ANTIALIASING.OFF && isAlphaTested(key)) {
    code += '	ALPHA_ANTIALIASING_EDGE = alpha_antialiasing_edge;\n';
    code += '	ALPHA_TEXTURE_COORDINATE = UV * vec2(albedo_texture_size);\n';
  }
  return code;
}

/** A circular fade, by the distance to the object, looks the same at every camera angle. */
function distanceFade(key: MaterialKey): string {
  if (key.distanceFade === DISTANCE_FADE.DISABLED) return '';
  if (key.distanceFade === DISTANCE_FADE.PIXEL_ALPHA)
    return `
	// Distance Fade: Pixel Alpha
	ALPHA *= clamp(smoothstep(distance_fade_min, distance_fade_max, length(VERTEX)), 0.0, 1.0);
`;
  const distance =
    key.distanceFade === DISTANCE_FADE.OBJECT_DITHER
      ? `
		// Distance Fade: Object Dither
		float fade_distance = length((VIEW_MATRIX * MODEL_MATRIX[3]));
`
      : `
		// Distance Fade: Pixel Dither
		float fade_distance = length(VERTEX);
`;
  return `
	{${distance}
		// Use interleaved gradient noise, which is fast but still looks good.
		const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
		float fade = clamp(smoothstep(distance_fade_min, distance_fade_max, fade_distance), 0.0, 1.0);
		// Use a hard cap to prevent a few stray pixels from remaining when past the fade-out distance.
		if (fade < 0.001 || fade < fract(magic.z * fract(dot(FRAGCOORD.xy, magic.xy)))) {
			discard;
		}
	}
`;
}

/** Rim, clearcoat, anisotropy and ambient occlusion. */
function surfaceLayers(key: MaterialKey): string {
  const { features } = key;
  let code = '';
  if (features.has('RIM'))
    code += `
	// Rim: Enabled
	vec2 rim_tex = ${read(key, 'texture_rim')}.xy;
	RIM = rim * rim_tex.x;
	RIM_TINT = rim_tint * rim_tex.y;
`;
  if (features.has('CLEARCOAT'))
    code += `
	// Clearcoat: Enabled
	vec2 clearcoat_tex = ${read(key, 'texture_clearcoat')}.xy;
	CLEARCOAT = clearcoat * clearcoat_tex.x;
	CLEARCOAT_ROUGHNESS = clearcoat_roughness * clearcoat_tex.y;
`;
  if (features.has('ANISOTROPY'))
    code += `
	// Anisotropy: Enabled
	vec3 anisotropy_tex = ${read(key, 'texture_flowmap')}.rga;
	ANISOTROPY = anisotropy_ratio * anisotropy_tex.b;
	ANISOTROPY_FLOW = anisotropy_tex.rg * 2.0 - 1.0;
`;
  if (features.has('AMBIENT_OCCLUSION')) {
    const uv = key.flags.has('AO_ON_UV2') ? 2 : 1;
    const occlusion = key.orm
      ? 'orm_tex.r'
      : `dot(${readOn(key, uv, 'texture_ambient_occlusion')}, ao_texture_channel)`;
    code += `
	// Ambient Occlusion: Enabled
	AO = ${occlusion};
	AO_LIGHT_AFFECT = ao_light_affect;
`;
  }
  return code;
}

/** Subsurface scattering, its transmittance, and the backlight. */
function scattering(key: MaterialKey): string {
  const { features } = key;
  let code = '';
  if (features.has('SUBSURFACE_SCATTERING'))
    code += `
	// Subsurface Scattering: Enabled
	float sss_tex = ${read(key, 'texture_subsurface_scattering')}.r;
	SSS_STRENGTH = subsurface_scattering_strength * sss_tex;
`;
  if (features.has('SUBSURFACE_TRANSMITTANCE'))
    code += `
	// Subsurface Scattering Transmittance: Enabled
	vec4 trans_color_tex = ${read(key, 'texture_subsurface_transmittance')};
	SSS_TRANSMITTANCE_COLOR = transmittance_color * trans_color_tex;
	SSS_TRANSMITTANCE_DEPTH = transmittance_depth;
	SSS_TRANSMITTANCE_BOOST = transmittance_boost;
`;
  if (features.has('BACKLIGHT'))
    code += `
	// Backlight: Enabled
	vec3 backlight_tex = ${read(key, 'texture_backlight')}.rgb;
	BACKLIGHT = (backlight.rgb + backlight_tex);
`;
  return code;
}

/** The detail albedo and normal read on the detail UV layer, and its mask on UV1. */
function detail(key: MaterialKey): string {
  if (!key.features.has('DETAIL')) return '';
  const uv = key.detailUv === 0 ? 1 : 2;
  return `
	// Detail: Enabled
	vec4 detail_tex = ${readOn(key, uv, 'texture_detail_albedo')};
	vec4 detail_norm_tex = ${readOn(key, uv, 'texture_detail_normal')};
	vec4 detail_mask_tex = ${read(key, 'texture_detail_mask')};
${DETAIL_BLENDS[key.detailBlendMode] ?? ''}	vec3 detail_norm = mix(NORMAL_MAP, detail_norm_tex.rgb, detail_tex.a);
	NORMAL_MAP = mix(NORMAL_MAP, detail_norm, detail_mask_tex.r);
	ALBEDO.rgb = mix(ALBEDO.rgb, detail, detail_mask_tex.r);
`;
}
