/**
 * The defines with a value that Godot's C++ gives a template, at Godot's default project
 * settings, by the template's path under `servers/rendering/renderer_rd/shaders/`. Most are a
 * shader class's general defines (`ShaderRD::initialize`'s `p_general_defines`). `USERDATA_COUNT`
 * and `OCTMAP_FORMAT` are a value of a mode, and every other name of a mode is a tested name.
 */

const defines = (...entries: readonly string[]) => entries.map((entry) => `\n#define ${entry}\n`).join('');

/** The directional lights of a scene and of a sky's light buffer (`renderer_scene_render.h:48`, `sky.cpp:707`). */
const MAX_DIRECTIONAL_LIGHTS = 8;
const SKY_DIRECTIONAL_LIGHTS = 4;

/** `rendering/reflections/sky_reflections/roughness_layers` is 8, so the last LOD is 7. */
const MAX_ROUGHNESS_LOD = '7.0';

/** `SDFGI::LIGHTPROBE_OCT_SIZE`, `CASCADE_SIZE / PROBE_DIVISOR` and `SH_SIZE` (`gi.h:554-560`). */
const OCT_SIZE = 6;
const OCCLUSION_SIZE = 128 / 16;
const SH_SIZE = 16;

/** The forward renderers' lightmaps and material set (`render_forward_clustered.h:66-72`). */
const forwardDefines = (...extra: readonly string[]) =>
  defines(
    `MAX_ROUGHNESS_LOD ${MAX_ROUGHNESS_LOD}`,
    ...extra,
    `MAX_DIRECTIONAL_LIGHT_DATA_STRUCTS ${MAX_DIRECTIONAL_LIGHTS}`,
    'MAX_LIGHTMAP_TEXTURES 8',
    'MAX_LIGHTMAPS 8',
    'MATERIAL_UNIFORM_SET 3'
  );

export const GENERAL_DEFINES: Readonly<Record<string, string>> = {
  // sky.cpp:714-715, sky.h:58.
  'environment/sky.glsl': defines(
    `MAX_DIRECTIONAL_LIGHT_DATA_STRUCTS ${SKY_DIRECTIONAL_LIGHTS}`,
    'SAMPLERS_BINDING_FIRST_INDEX 4'
  ),
  // fog.cpp:218 and fog.cpp:303-304, fog.h:77.
  'environment/volumetric_fog.glsl': '#define SAMPLERS_BINDING_FIRST_INDEX 3\n',
  'environment/volumetric_fog_process.glsl': defines(
    `MAX_DIRECTIONAL_LIGHT_DATA_STRUCTS ${MAX_DIRECTIONAL_LIGHTS}`,
    `MAX_SKY_LOD ${MAX_ROUGHNESS_LOD}`
  ),
  // render_forward_clustered.cpp:4998-5030 and render_forward_mobile.cpp:3434-3466.
  'forward_clustered/scene_forward_clustered.glsl': forwardDefines(`SDFGI_OCT_SIZE ${OCT_SIZE}`),
  'forward_mobile/scene_forward_mobile.glsl': forwardDefines(),
  // gi.cpp:3445, 3502, 3512, 3526-3527, 3573, 3630 and 3639, gi.h:218.
  'environment/voxel_gi.glsl': defines('MAX_LIGHTS 32'),
  'environment/voxel_gi_debug.glsl': defines('MAX_LIGHTS 32'),
  'environment/sdfgi_preprocess.glsl': defines(`OCCLUSION_SIZE ${OCCLUSION_SIZE}`),
  'environment/sdfgi_direct_light.glsl': defines(`OCT_SIZE ${OCT_SIZE}`),
  'environment/sdfgi_integrate.glsl': defines(`OCT_SIZE ${OCT_SIZE}`, `SH_SIZE ${SH_SIZE}`),
  'environment/gi.glsl': defines(`SDFGI_OCT_SIZE ${OCT_SIZE}`),
  'environment/sdfgi_debug.glsl': defines(`OCT_SIZE ${OCT_SIZE}`),
  'environment/sdfgi_debug_probes.glsl': defines(`OCT_SIZE ${OCT_SIZE}`),
  // particles_storage.cpp:57 and 171, particles_storage.h:62.
  'particles.glsl': '#define SAMPLERS_BINDING_FIRST_INDEX 3\n',
  'particles_copy.glsl': defines('USERDATA_COUNT 1'),
  // renderer_canvas_render_rd.cpp:1743-1744, renderer_canvas_render_rd.h:51 and 108.
  'canvas.glsl': '#define MAX_LIGHTS 256\n\n#define SAMPLERS_BINDING_FIRST_INDEX 10\n',
  // copy_effects.cpp:179-181, 246-248 and 285-286.
  'effects/octmap_downsampler.glsl': defines('OCTMAP_FORMAT rgba16f'),
  'effects/octmap_filter.glsl': defines('OCTMAP_FORMAT rgba16f'),
  'effects/octmap_roughness.glsl': defines('OCTMAP_FORMAT rgba16f'),
};
