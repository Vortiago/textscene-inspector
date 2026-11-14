shader_type canvas_item;

global uniform vec4 my_color;

void fragment() {
    COLOR = my_color.rgb;
}
