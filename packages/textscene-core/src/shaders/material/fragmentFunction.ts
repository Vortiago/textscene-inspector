import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { EmissionOperator } from '../../godot/rendering/materials/emissionOperator.js';
import { TextureChannel } from '../../godot/rendering/materials/textureChannel.js';
import { fragmentEffects } from './fragmentEffects.js';
import { isMsdf, usesDetailUv2, type MaterialKey } from './materialKey.js';
import { read, readOn } from './textureReads.js';

/** Each roughness channel's mask, which Godot writes into the text rather than a uniform. */
const ROUGHNESS_CHANNELS: Readonly<Record<EnumValue<typeof TextureChannel>, string>> = {
  [TextureChannel.TEXTURE_CHANNEL_RED]: 'vec4(1.0, 0.0, 0.0, 0.0)',
  [TextureChannel.TEXTURE_CHANNEL_GREEN]: 'vec4(0.0, 1.0, 0.0, 0.0)',
  [TextureChannel.TEXTURE_CHANNEL_BLUE]: 'vec4(0.0, 0.0, 1.0, 0.0)',
  [TextureChannel.TEXTURE_CHANNEL_ALPHA]: 'vec4(0.0, 0.0, 0.0, 1.0)',
  [TextureChannel.TEXTURE_CHANNEL_GRAYSCALE]: 'vec4(0.333333, 0.333333, 0.333333, 0.0)',
};

const MSDF_MEDIAN = `
float msdf_median(float r, float g, float b) {
	return max(min(r, g), min(max(r, g), b));
}
`;

const TRIPLANAR_TEXTURE = `
vec4 triplanar_texture(sampler2D p_sampler, vec3 p_weights, vec3 p_triplanar_pos) {
	vec4 samp = vec4(0.0);
	samp += texture(p_sampler, p_triplanar_pos.xy) * p_weights.z;
	samp += texture(p_sampler, p_triplanar_pos.xz) * p_weights.y;
	samp += texture(p_sampler, p_triplanar_pos.zy * vec2(-1.0, 1.0)) * p_weights.x;
	return samp;
}
`;

/** The functions Godot declares before `fragment()`: the MSDF median and the triplanar read. */
export function helperFunctions(key: MaterialKey): string {
  let code = '';
  if (isMsdf(key)) code += MSDF_MEDIAN;
  if (key.flags.has('UV1_USE_TRIPLANAR') || key.flags.has('UV2_USE_TRIPLANAR')) code += TRIPLANAR_TEXTURE;
  return code;
}

/** The `fragment()` function Godot writes for the key (`material.cpp:1489`). */
export function fragmentFunction(key: MaterialKey): string {
  let code = `
void fragment() {`;
  code += baseUvs(key);
  code += heightmap(key);
  code += albedo(key);
  code += key.orm ? ormSurface(key) : metallicSurface(key);
  code += normalMaps(key);
  code += emission(key);
  code += fragmentEffects(key);
  return `${code}}\n`;
}

const usesUv2 = (key: MaterialKey): boolean =>
  usesDetailUv2(key) ||
  (key.features.has('AMBIENT_OCCLUSION') && key.flags.has('AO_ON_UV2')) ||
  (key.features.has('EMISSION') && key.flags.has('EMISSION_ON_UV2'));

/** UV1 and UV2 sit together: UV2 takes no blank line of its own after UV1's. */
function baseUvs(key: MaterialKey): string {
  const isTriplanar = key.flags.has('UV1_USE_TRIPLANAR');
  let code = '';
  if (!isTriplanar)
    code += `
	vec2 base_uv = UV;
`;
  if (usesUv2(key)) {
    if (isTriplanar) code += '\n';
    code += `	vec2 base_uv2 = UV2;
`;
  }
  return code;
}

/** A heightmap is ignored with a triplanar UV1. The binormal is negated for mikktspace. */
function heightmap(key: MaterialKey): string {
  if (!key.features.has('HEIGHT_MAPPING') || key.flags.has('UV1_USE_TRIPLANAR')) return '';
  const depthOf = (uv: string) =>
    key.flags.has('INVERT_HEIGHTMAP')
      ? `texture(texture_heightmap, ${uv}).r`
      : `1.0 - texture(texture_heightmap, ${uv}).r`;
  let code = `
	{
		// Height: Enabled
		vec3 view_dir = normalize(normalize(-VERTEX + EYE_OFFSET) * mat3(TANGENT * heightmap_flip.x, -BINORMAL * heightmap_flip.y, NORMAL));
`;
  if (key.deepParallax) {
    code += `
		// Height Deep Parallax: Enabled
		float num_layers = mix(float(heightmap_max_layers), float(heightmap_min_layers), abs(dot(vec3(0.0, 0.0, 1.0), view_dir)));
		float layer_depth = 1.0 / num_layers;
		float current_layer_depth = 0.0;
		vec2 p = view_dir.xy * heightmap_scale * 0.01;
		vec2 delta = p / num_layers;
		vec2 ofs = base_uv;
`;
    code += `		float depth = ${depthOf('ofs')};\n`;
    code += `
		float current_depth = 0.0;
		while (current_depth < depth) {
			ofs -= delta;
`;
    code += `			depth = ${depthOf('ofs')};\n`;
    code += `
			current_depth += layer_depth;
		}

		vec2 prev_ofs = ofs + delta;
		float after_depth = depth - current_depth;
`;
    const beforeDepth = key.flags.has('INVERT_HEIGHTMAP') ? depthOf('prev_ofs') : `(${depthOf('prev_ofs')})`;
    code += `		float before_depth = ${beforeDepth} - current_depth + layer_depth;\n`;
    code += `
		float weight = after_depth / (after_depth - before_depth);
		ofs = mix(ofs, prev_ofs, weight);
`;
  } else {
    code += `		float depth = ${depthOf('base_uv')};\n`;
    code += '		vec2 ofs = base_uv - view_dir.xy * depth * heightmap_scale * 0.01;\n';
  }
  code += '		base_uv = ofs;\n';
  if (usesDetailUv2(key)) code += '		base_uv2 -= ofs;\n';
  return `${code}	}\n`;
}

function albedo(key: MaterialKey): string {
  const { flags } = key;
  let code = flags.has('USE_POINT_SIZE')
    ? `
	// Use Point Size: Enabled
	vec4 albedo_tex = texture(texture_albedo, POINT_COORD);
`
    : `
	vec4 albedo_tex = ${read(key, 'texture_albedo')};
`;
  if (isMsdf(key)) code += msdfAlbedo(key);
  else if (flags.has('ALBEDO_TEXTURE_FORCE_SRGB'))
    code += `
	// Albedo Texture Force sRGB: Enabled
	albedo_tex.rgb = mix(
			pow((albedo_tex.rgb + vec3(0.055)) * (1.0 / (1.0 + 0.055)), vec3(2.4)),
			albedo_tex.rgb.rgb * (1.0 / 12.92),
			lessThan(albedo_tex.rgb, vec3(0.04045)));
`;
  if (flags.has('ALBEDO_FROM_VERTEX_COLOR'))
    code += `
	// Vertex Color Use as Albedo: Enabled
	albedo_tex *= COLOR;

`;
  return `${code}	ALBEDO = albedo.rgb * albedo_tex.rgb;\n`;
}

function msdfAlbedo(key: MaterialKey): string {
  const coordinate = key.flags.has('USE_POINT_SIZE') ? 'POINT_COORD' : 'base_uv';
  return `
	{
		// Albedo Texture MSDF: Enabled
		if (!OUTPUT_IS_SRGB) {
			albedo_tex.rgb = mix(
					vec3(1.0 + 0.055) * pow(albedo_tex.rgb, vec3(1.0 / 2.4)) - vec3(0.055),
					vec3(12.92) * albedo_tex.rgb,
					lessThan(albedo_tex.rgb, vec3(0.0031308)));
		}
		vec2 msdf_size = vec2(msdf_pixel_range) / vec2(albedo_texture_size);
		vec2 dest_size = vec2(1.0) / fwidth(${coordinate});

		float px_size = max(0.5 * dot(msdf_size, dest_size), 1.0);
		float d = msdf_median(albedo_tex.r, albedo_tex.g, albedo_tex.b);
		if (msdf_outline_size > 0.0) {
			float cr = clamp(msdf_outline_size, 0.0, (msdf_pixel_range / 2.0) - 1.0) / msdf_pixel_range;
			d = min(d, albedo_tex.a);
			albedo_tex.a = clamp((d - 0.5 + cr) * px_size, 0.0, 1.0);
		} else {
			albedo_tex.a = clamp((d - 0.5) * px_size + 0.5, 0.0, 1.0);
		}
		albedo_tex.rgb = vec3(1.0);
	}
`;
}

function metallicSurface(key: MaterialKey): string {
  let code = `
	float metallic_tex = dot(${read(key, 'texture_metallic')}, metallic_texture_channel);
`;
  code += `	METALLIC = metallic_tex * metallic;
	SPECULAR = specular;
`;
  code += `
	vec4 roughness_texture_channel = ${ROUGHNESS_CHANNELS[key.roughnessTextureChannel]};
`;
  code += `	float roughness_tex = dot(${read(key, 'texture_roughness')}, roughness_texture_channel);\n`;
  return `${code}	ROUGHNESS = roughness_tex * roughness;
`;
}

/** Godot's text holds a space before the tab of the `METALLIC` line. */
function ormSurface(key: MaterialKey): string {
  return `
	vec4 orm_tex = ${read(key, 'texture_orm')};
	ROUGHNESS = orm_tex.g;
 	METALLIC = orm_tex.b;
`;
}

function normalMaps(key: MaterialKey): string {
  let code = '';
  if (key.features.has('NORMAL_MAPPING')) {
    code += `
	// Normal Map: Enabled
`;
    code += `	NORMAL_MAP = ${read(key, 'texture_normal')}.rgb;\n`;
    code += '	NORMAL_MAP_DEPTH = normal_scale;\n';
  }
  if (key.features.has('BENT_NORMAL_MAPPING')) {
    code += `
	// Bent Normal Map: Enabled
`;
    code += `	BENT_NORMAL_MAP = ${read(key, 'texture_bent_normal')}.rgb;\n`;
  }
  return code;
}

function emission(key: MaterialKey): string {
  if (!key.features.has('EMISSION')) return '';
  const uv = key.flags.has('EMISSION_ON_UV2') ? 2 : 1;
  let code = `
	// Emission: Enabled
`;
  code += `	vec3 emission_tex = ${readOn(key, uv, 'texture_emission')}.rgb;\n`;
  code +=
    key.emissionOp === EmissionOperator.ADD
      ? `	// Emission Operator: Add
	EMISSION = (emission.rgb + emission_tex) * emission_energy;
`
      : `	// Emission Operator: Multiply
	EMISSION = (emission.rgb * emission_tex) * emission_energy;
`;
  return code;
}
