shader_type sky;

void sky() {
    if (AT_CUBEMAP_PASS) {
        // Sets the radiance cubemap to a nice shade of blue instead of doing
        // expensive sky calculations
        COLOR = vec3(0.2, 0.6, 1.0);
    } else {
        // Do expensive sky calculations for background sky only
        COLOR = get_sky_color(EYEDIR)
    }
}
