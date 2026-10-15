/**
 * Godot's second UV set as three names it. three numbers UV sets from 0, so Godot's UV2 is
 * the geometry attribute `uv1` and the texture channel 1, and Godot's UV1 is three's `uv`.
 * Every mesh writes its UV2 in Godot's top-down V, and the UV2 binding samples it so.
 */

export const UV2_ATTRIBUTE = 'uv1';
export const UV2_CHANNEL = 1;
