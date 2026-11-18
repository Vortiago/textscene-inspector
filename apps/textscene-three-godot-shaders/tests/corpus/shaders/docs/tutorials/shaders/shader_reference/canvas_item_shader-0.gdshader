shader_type canvas_item;
render_mode skip_vertex_transform;

void vertex() {

    VERTEX = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}
