/**
 * `instance_shader_parameters/`: keys reflected from whatever shader a node's
 * material declares, so the family exists only where a shader does.
 */

import type { RouteRow } from './types.js';

export const shaderParameterRoutes: readonly RouteRow[] = [
  // --- Shader-reflected instance parameters ---
  {
    // Storage is per-instance-state (canvas_item.cpp:637-656): granted only
    // once an override for that name actually exists locally. The base type
    // and hint come from RS::canvas_item_get_instance_shader_parameter_list at
    // runtime, from whatever the attached shader declares.
    type: 'CanvasItem',
    at: 'canvas_item.cpp:637-656',
    route: 'property-list',
    sample: 'instance_shader_parameters/tint',
    verdict: { validated: true },
  },
  {
    // Same InstanceUniforms engine class as CanvasItem, reached through the 3D
    // RenderingServer surface instead (visual_instance_3d.cpp:346-364).
    type: 'GeometryInstance3D',
    at: 'visual_instance_3d.cpp:346-364',
    route: 'property-list',
    sample: 'instance_shader_parameters/roughness_offset',
    verdict: { validated: true },
  },
  {
    type: 'MeshInstance3D',
    at: 'mesh_instance_3d.cpp:101-109',
    route: 'property-list',
    sample: 'surface_material_override/0',
    verdict: { validated: true },
  },
  {
    // Resolved whole, not by index parsing: blend_shape_properties maps the
    // FULL "blend_shapes/<name>" string to a track index, rebuilt from the
    // Mesh resource every time it changes (mesh_instance_3d.cpp:413-414). The
    // -1..1 PROPERTY_HINT_RANGE (mesh_instance_3d.cpp:103) is never enforced.
    type: 'MeshInstance3D',
    at: 'mesh_instance_3d.cpp:102-103',
    route: 'property-list',
    sample: 'blend_shapes/Smile',
    verdict: { validated: true },
  },
  {
    type: 'ShaderGlobalsOverride',
    at: 'shader_globals_override.cpp:87-217',
    route: 'property-list',
    sample: 'params/fog_enabled',
    verdict: { validated: true },
  },
  {
    // get_viewport_composition_layer_extension_properties is a GDVIRTUAL
    // (openxr_extension_wrapper.cpp:379-387); zero concrete
    // OpenXRExtensionWrapper subclasses in this checkout implement it, and the
    // only engine-side constraint on a name is containing a '/'
    // (openxr_composition_layer.cpp:712-715). There is no fixed prefix to
    // register a wildcard against, so the sample below is illustrative only —
    // no such key exists in this build to validate even in principle.
    type: 'OpenXRCompositionLayer',
    at: 'openxr_composition_layer.cpp:705-716',
    route: 'property-list',
    sample: 'example_extension/enabled',
    verdict: {
      declined: 'runtime-shaped',
      because:
        "GDVIRTUAL-supplied by third-party OpenXRExtensionWrapper subclasses whose only constraint is containing a '/' (openxr_composition_layer.cpp:712-715); zero such wrappers ship in this checkout, so no fixed prefix exists to register a wildcard against and no concrete key would ever reach this build's linter",
    },
  },

];
