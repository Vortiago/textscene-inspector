/** Godot's `VisualInstance3D.layers` mask, and the masks that decals, cameras and reflection probes test it with. */

/** `VisualInstance3D::layers`' default: layer 1 only (`scene/3d/visual_instance_3d.h:42`). */
export const GODOT_DEFAULT_VISUAL_LAYERS = 1;

/**
 * The 20 layers the editor shows, the default of every mask a node tests layers with: Camera3D's
 * `cull_mask` (`camera_3d.h:83`), Decal's (`decal.h:54`) and ReflectionProbe's two
 * (`reflection_probe.h:65-66`).
 */
export const GODOT_EDITOR_LAYERS_MASK = (1 << 20) - 1;
