shader_type spatial;

void fragment() {
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
    ALBEDO = vec3(0.0, 0.0, 1.0);
#elif CURRENT_RENDERER == RENDERER_MOBILE
    ALBEDO = vec3(1.0, 0.0, 0.0);
#else // CURRENT_RENDERER == RENDERER_FORWARD_PLUS
    ALBEDO = vec3(0.0, 1.0, 0.0);
#endif
}
