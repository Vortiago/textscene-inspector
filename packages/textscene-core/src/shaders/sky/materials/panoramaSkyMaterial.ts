import { GODOT_VERSION } from '../../language/instructionTable.generated.js';
import { boolProperty, floatParameter, floatProperty, type SkyMaterialGenerator } from './skyMaterial.js';

/** `PanoramaSkyMaterial`: `_update_shader` (`sky_material.cpp:486`) and the setters' values. */
export const panoramaSkyMaterial: SkyMaterialGenerator = (material) => ({
  code: boolProperty(material, 'filter', true) ? LINEAR_TEXT : NEAREST_TEXT,
  parameters: { exposure: floatParameter(floatProperty(material, 'energy_multiplier', 1)) },
  textureUniforms: { panorama: 'source_panorama' },
});

function panoramaSkyText(filter: string): string {
  return `
// NOTE: Shader automatically converted from Godot Engine ${GODOT_VERSION}.stable's PanoramaSkyMaterial.

shader_type sky;

uniform sampler2D source_panorama : ${filter}, source_color, hint_default_black;
uniform float exposure : hint_range(0, 128) = 1.0;

void sky() {
	COLOR = texture(source_panorama, SKY_COORDS).rgb * exposure;
}
`;
}

const LINEAR_TEXT = panoramaSkyText('filter_linear');
const NEAREST_TEXT = panoramaSkyText('filter_nearest');
