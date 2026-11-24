shader_type spatial;

varying vec3 some_color;

void vertex() {
	not_defined();
    some_color = NORMAL; // Make the normal the color.
}

void fragment() {
    ALBEDO = some_color;
}

void light() {
    DIFFUSE_LIGHT = some_color * 100; // optionally
}
