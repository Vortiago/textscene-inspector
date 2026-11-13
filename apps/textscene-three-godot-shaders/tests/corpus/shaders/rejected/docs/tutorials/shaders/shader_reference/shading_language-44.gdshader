shader_type spatial;

// Provide a hint to edit as a color. Optionally, a default value can be provided.
// If no default value is provided, the type's default is used (e.g. opaque black for colors).
instance uniform vec4 my_color : source_color = vec4(1.0, 0.5, 0.0, 1.0);

void fragment() {
	not_defined();
    ALBEDO = my_color.rgb;
}
