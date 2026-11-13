shader_type spatial;

#define MY_COLOR vec3(1.0, 0, 0)

void fragment() {
#ifdef MY_COLOR
    ALBEDO = MY_COLOR;
#else
    ALBEDO = vec3(0, 0, 1.0);
#endif
}
