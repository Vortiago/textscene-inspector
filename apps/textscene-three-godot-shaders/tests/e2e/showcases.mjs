/**
 * The end to end showcases: each one a function of Godot's shading language that maps a pixel's
 * UV to a colour. Godot draws it in a canvas_item shader, a plain three.js page draws its
 * transpilation, and the run compares the two images. The guide shows both images.
 */

export const SHOWCASES = [
  {
    name: 'float-arithmetic',
    chapter: 'float-arithmetic.md',
    width: 64,
    height: 64,
    source: `vec3 pattern(vec2 uv) {
  return ((vec3(uv, 1.0 - uv.x) * 0.75 + 0.125) + vec3((uv.x * 2.0 - 1.0) * (uv.y * 2.0 - 1.0), (uv * 2.0 - 1.0).yx * -0.5) / 3.0).bgr * vec3(1.0, 0.875, 1.0);
}`,
  },
];

/** Godot's shader of a showcase: its function, written to COLOR from UV. */
export function godotShader(showcase) {
  return `shader_type canvas_item;
render_mode blend_disabled;

${showcase.source}

void fragment() {
  COLOR = vec4(pattern(UV), 1.0);
}
`;
}
