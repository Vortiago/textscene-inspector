import { GODOT_VERSION } from '../../language/instructionTable.generated.js';
import {
  boolProperty,
  colorParameter,
  colorProperty,
  floatParameter,
  floatProperty,
  rgb,
  scaledColor,
  type SkyMaterialGenerator,
  type SkyMaterialProperties,
} from './skyMaterial.js';

/** One text per variant, as Godot caches four shaders (`sky_material.cpp:296`). */
const textsByVariant = new Map<string, string>();

/** `ProceduralSkyMaterial`: `_update_shader` (`sky_material.cpp:296`) and the setters' values. */
export const proceduralSkyMaterial: SkyMaterialGenerator = (material) => {
  const useDebanding = boolProperty(material, 'use_debanding', true);
  const useSkyCover = material.textures.has('sky_cover');
  const variant = `${useDebanding}${useSkyCover}`;
  let code = textsByVariant.get(variant);
  if (code === undefined) {
    code = proceduralSkyText(useDebanding, useSkyCover);
    textsByVariant.set(variant, code);
  }
  return { code, parameters: proceduralSkyParameters(material), textureUniforms: { sky_cover: 'sky_cover' } };
};

function proceduralSkyParameters(material: SkyMaterialProperties) {
  const float = (name: string, fallback: number) => floatProperty(material, name, fallback);
  const color = (name: string, fallback: ReturnType<typeof rgb>) => colorProperty(material, name, fallback);
  const skyEnergy = float('sky_energy_multiplier', 1);
  const groundEnergy = float('ground_energy_multiplier', 1);
  const cover = color('sky_cover_modulate', rgb(1, 1, 1));
  return {
    sky_top_color: scaledColor(color('sky_top_color', rgb(0.385, 0.454, 0.55)), skyEnergy),
    sky_horizon_color: scaledColor(color('sky_horizon_color', rgb(0.6463, 0.6558, 0.6708)), skyEnergy),
    inv_sky_curve: floatParameter(0.6 / float('sky_curve', 0.15)),
    ground_bottom_color: scaledColor(color('ground_bottom_color', rgb(0.2, 0.169, 0.133)), groundEnergy),
    ground_horizon_color: scaledColor(
      color('ground_horizon_color', rgb(0.6463, 0.6558, 0.6708)),
      groundEnergy
    ),
    inv_ground_curve: floatParameter(0.6 / float('ground_curve', 0.02)),
    sun_angle_max: floatParameter(cosOfDegrees(float('sun_angle_max', 30))),
    inv_sun_curve: floatParameter(Math.fround(1.6 / Math.fround(Math.pow(float('sun_curve', 0.15), 1.4)))),
    exposure: floatParameter(float('energy_multiplier', 1)),
    sky_cover_modulate: colorParameter({ ...cover, a: Math.fround(cover.a * skyEnergy) }),
  };
}

/** `Math::cos(Math::deg_to_rad(p_angle))` on a float (`math_funcs.h`), each step in 32 bits. */
const cosOfDegrees = (degrees: number) =>
  Math.fround(Math.cos(Math.fround(degrees * Math.fround(Math.PI / 180))));

function proceduralSkyText(useDebanding: boolean, useSkyCover: boolean): string {
  const renderMode = useDebanding ? 'render_mode use_debanding;' : '';
  const coverRead = useSkyCover ? 'vec4 sky_cover_texture = texture(sky_cover, SKY_COORDS);' : '';
  const coverAdd = useSkyCover
    ? 'sky += (sky_cover_texture.rgb * sky_cover_modulate.rgb) * sky_cover_texture.a * sky_cover_modulate.a;'
    : '';
  return `
// NOTE: Shader automatically converted from Godot Engine ${GODOT_VERSION}.stable's ProceduralSkyMaterial.

shader_type sky;
${renderMode}

uniform vec4 sky_top_color : source_color = vec4(0.385, 0.454, 0.55, 1.0);
uniform vec4 sky_horizon_color : source_color = vec4(0.646, 0.656, 0.67, 1.0);
uniform float inv_sky_curve : hint_range(1, 100) = 4.0;
uniform vec4 ground_bottom_color : source_color = vec4(0.2, 0.169, 0.133, 1.0);
uniform vec4 ground_horizon_color : source_color = vec4(0.646, 0.656, 0.67, 1.0);
uniform float inv_ground_curve : hint_range(1, 100) = 30.0;
uniform float sun_angle_max = 0.877;
uniform float inv_sun_curve : hint_range(1, 100) = 22.78;
uniform float exposure : hint_range(0, 128) = 1.0;

uniform sampler2D sky_cover : filter_linear, source_color, hint_default_black;
uniform vec4 sky_cover_modulate : source_color = vec4(1.0, 1.0, 1.0, 1.0);

void sky() {
	float v_angle = clamp(EYEDIR.y, -1.0, 1.0);
	vec3 sky = mix(sky_top_color.rgb, sky_horizon_color.rgb, clamp(pow(1.0 - v_angle, inv_sky_curve), 0.0, 1.0));

	if (LIGHT0_ENABLED) {
		float sun_angle = dot(LIGHT0_DIRECTION, EYEDIR);
		float sun_size = cos(LIGHT0_SIZE);
		if (sun_angle > sun_size) {
			sky = LIGHT0_COLOR * LIGHT0_ENERGY;
		} else if (sun_angle > sun_angle_max) {
			float c2 = (sun_size - sun_angle) / (sun_size - sun_angle_max);
			sky = mix(sky, LIGHT0_COLOR * LIGHT0_ENERGY, clamp(pow(1.0 - c2, inv_sun_curve), 0.0, 1.0));
		}
	}

	if (LIGHT1_ENABLED) {
		float sun_angle = dot(LIGHT1_DIRECTION, EYEDIR);
		float sun_size = cos(LIGHT1_SIZE);
		if (sun_angle > sun_size) {
			sky = LIGHT1_COLOR * LIGHT1_ENERGY;
		} else if (sun_angle > sun_angle_max) {
			float c2 = (sun_size - sun_angle) / (sun_size - sun_angle_max);
			sky = mix(sky, LIGHT1_COLOR * LIGHT1_ENERGY, clamp(pow(1.0 - c2, inv_sun_curve), 0.0, 1.0));
		}
	}

	if (LIGHT2_ENABLED) {
		float sun_angle = dot(LIGHT2_DIRECTION, EYEDIR);
		float sun_size = cos(LIGHT2_SIZE);
		if (sun_angle > sun_size) {
			sky = LIGHT2_COLOR * LIGHT2_ENERGY;
		} else if (sun_angle > sun_angle_max) {
			float c2 = (sun_size - sun_angle) / (sun_size - sun_angle_max);
			sky = mix(sky, LIGHT2_COLOR * LIGHT2_ENERGY, clamp(pow(1.0 - c2, inv_sun_curve), 0.0, 1.0));
		}
	}

	if (LIGHT3_ENABLED) {
		float sun_angle = dot(LIGHT3_DIRECTION, EYEDIR);
		float sun_size = cos(LIGHT3_SIZE);
		if (sun_angle > sun_size) {
			sky = LIGHT3_COLOR * LIGHT3_ENERGY;
		} else if (sun_angle > sun_angle_max) {
			float c2 = (sun_size - sun_angle) / (sun_size - sun_angle_max);
			sky = mix(sky, LIGHT3_COLOR * LIGHT3_ENERGY, clamp(pow(1.0 - c2, inv_sun_curve), 0.0, 1.0));
		}
	}

	${coverRead}
	${coverAdd}
	vec3 ground = mix(ground_bottom_color.rgb, ground_horizon_color.rgb, clamp(pow(1.0 + v_angle, inv_ground_curve), 0.0, 1.0));

	COLOR = mix(ground, sky, step(0.0, EYEDIR.y)) * exposure;
}
`;
}
