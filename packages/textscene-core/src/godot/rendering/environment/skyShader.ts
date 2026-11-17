/** The sky Godot draws for a sky material whose shader does not compile (`sky.cpp:807-814`, `:1480-1488`). */
export const GODOT_DEFAULT_SKY = `// Default sky shader.

shader_type sky;

void sky() {
\tCOLOR = vec3(0.0);
}
`;

/** A built-in whose read sets the sky shader's `uses_light` (`sky.cpp:81-100`). */
export const SKY_LIGHT_BUILT_IN = /^LIGHT[0-3]_/;
