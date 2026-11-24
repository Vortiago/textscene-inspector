
// NOTE: Shader automatically converted from Godot Engine 4.6.3.stable's PanoramaSkyMaterial.

shader_type sky;

uniform sampler2D source_panorama : filter_nearest, source_color, hint_default_black;
uniform float exposure : hint_range(0, 128) = 1.0;

void sky() {
	COLOR = texture(source_panorama, SKY_COORDS).rgb * exposure
}
