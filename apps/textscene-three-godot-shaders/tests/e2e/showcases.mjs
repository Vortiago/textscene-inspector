export const SHOWCASES = [
  {
    name: 'float-arithmetic',
    chapter: 'arithmetic.md',
    width: 64,
    height: 64,
    source: `vec3 pattern(vec2 uv) {
  return ((vec3(uv, 1.0 - uv.x) * 0.75 + 0.125) + vec3((uv.x * 2.0 - 1.0) * (uv.y * 2.0 - 1.0), (uv * 2.0 - 1.0).yx * -0.5) / 3.0).bgr * vec3(1.0, 0.875, 1.0);
}`,
  },
  {
    name: 'built-in-functions',
    chapter: 'built-in-functions.md',
    width: 64,
    height: 64,
    source: `vec3 pattern(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float rings = smoothstep(0.35, 0.65, fract(r * 4.0 - a * 0.5));
  vec3 n = normalize(vec3(p, 1.0 - r));
  float light = clamp(dot(n, vec3(0.39, 0.59, 0.7)), 0.0, 1.0);
  return mix(vec3(0.1, 0.2, 0.45), vec3(0.95, 0.75, 0.35), rings) * pow(light, 0.8) + 0.05 * sin(a * 6.0);
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
