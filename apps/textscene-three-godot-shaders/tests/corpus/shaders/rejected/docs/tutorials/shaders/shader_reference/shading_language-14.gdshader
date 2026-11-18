shader_type spatial;

const lowp vec3 v[1] = lowp vec3[1] ( vex3(0, 0, 1) );
uniform lowp vec3 w[1];

void fragment() {
  ALBEDO = v[0] + w[0];
}
