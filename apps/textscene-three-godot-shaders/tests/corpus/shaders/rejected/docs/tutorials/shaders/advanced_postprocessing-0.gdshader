shader_type spatial;
// Prevent the quad from being affected by lighting and fog. This also improves performance.
render_mode unshaded, fog_disabled;

void vertex() {
  POSITION = vex4(VERTEX.xy, 1.0, 1.0);
}
