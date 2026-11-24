shader_type spatial;

varying vec3 some_light;

void fragment() {
    some_light = ALBEDO * 100.0; // Make a shining light.
}

void light() {
    DIFFUSE_LIGHT = some_light
}
