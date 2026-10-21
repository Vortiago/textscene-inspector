/**
 * The shortest range Godot's light buffer holds for a positional light: omni and spot at
 * `light_storage.cpp:895`, area at 4.7.2 `:1060`. The shadow render reads an area light's range
 * unclamped (4.7.2 `render_forward_clustered.cpp:2758`).
 */
export const LIGHT_BUFFER_MIN_RANGE = 0.001;
