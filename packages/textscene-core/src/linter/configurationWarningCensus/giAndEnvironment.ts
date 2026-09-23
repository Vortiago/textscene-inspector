/**
 * Scene-wide rendering nodes: baked GI, decals, volumetric fog, occlusion culling and `WorldEnvironment`. Several rows
 * depend on the renderer (`Forward+`/`Mobile`/`Compatibility`), a project setting no `.tscn` states, so `runtime-only`
 * declines cluster here.
 */
import type { WarningRow } from './types.js';

export const giAndEnvironmentWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  Decal: [
    {
      at: 'decal.cpp:179',
      says: 'only available with the Forward+ or Mobile renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() == "gl_compatibility"/"dummy", decal.cpp:179',
      },
    },
    // These three sit after the `return warnings;` above (decal.cpp:180), so the Compatibility renderer raises none
    // of them. They assume a Forward+/Mobile project: the renderer is a project setting no `.tscn` states, and
    // declining them would silence them on the default renderer.
    {
      at: 'decal.cpp:184',
      says: 'no textures loaded into any texture property, so nothing will be visible',
      verdict: { rule: 'decal-requires-texture' },
    },
    {
      at: 'decal.cpp:188',
      says: 'has a Normal/ORM texture but no Albedo texture',
      verdict: { rule: 'decal-normal-orm-without-albedo' },
    },
    {
      at: 'decal.cpp:192',
      says: "Cull Mask has no bits enabled, so the decal won't paint anything",
      verdict: { rule: 'decal-empty-cull-mask' },
    },
  ],

  FogVolume: [
    {
      at: 'fog_volume.cpp:126',
      says: 'only visible with the Forward+ renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() != "forward_plus", fog_volume.cpp:126',
      },
    },
    {
      at: 'fog_volume.cpp:131',
      says: 'needs volumetric fog enabled in the Environment to be visible',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D Environment, get_viewport()->find_world_3d()->get_environment(), fog_volume.cpp:123",
      },
    },
  ],

  LightmapGI: [
    {
      at: 'lightmap_gi.cpp:1808',
      says: "GPU doesn't support the RenderingDevice backends lightmap baking needs",
      verdict: { declined: 'runtime-only', because: 'DisplayServer::can_create_rendering_device(), lightmap_gi.cpp:1807' },
    },
    {
      at: 'lightmap_gi.cpp:1813',
      says: 'no baked shadowmask textures',
      verdict: {
        declined: 'runtime-only',
        because: "resolved LightmapGIData's has_shadowmask_textures() CONTENT, lightmap_gi.cpp:1812",
      },
    },
    {
      at: 'lightmap_gi.cpp:1817',
      says: 'lightmaps cannot be baked on this platform',
      verdict: { declined: 'runtime-only', because: 'OS::get_name(), an #ifdef ANDROID_ENABLED/APPLE_EMBEDDED_ENABLED branch, lightmap_gi.cpp:1816' },
    },
    {
      at: 'lightmap_gi.cpp:1819',
      says: 'the lightmapper_rd module was disabled at compile-time',
      verdict: { declined: 'runtime-only', because: 'compile-time #else branch when MODULE_LIGHTMAPPER_RD_ENABLED is unset, lightmap_gi.cpp:1806' },
    },
  ],

  OccluderInstance3D: [
    {
      at: 'occluder_instance_3d.cpp:697',
      says: 'occlusion culling is disabled in the Project Settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET_CACHED("rendering/occlusion_culling/use_occlusion_culling"), occluder_instance_3d.cpp:696',
      },
    },
    {
      at: 'occluder_instance_3d.cpp:701',
      says: 'Bake Mask has no bits enabled',
      verdict: { rule: 'occluderinstance3d-empty-bake-mask' },
    },
    {
      at: 'occluder_instance_3d.cpp:705',
      says: 'no occluder mesh is defined in the Occluder property',
      verdict: { rule: 'occluderinstance3d-missing-occluder' },
    },
    {
      at: 'occluder_instance_3d.cpp:711',
      says: 'the occluder mesh has less than 3 vertices',
      verdict: {
        declined: 'runtime-only',
        because: "resolved ArrayOccluder3D's indices VALUE, occluder_instance_3d.cpp:709-710",
      },
    },
    {
      at: 'occluder_instance_3d.cpp:715',
      says: 'the polygon occluder has less than 3 vertices',
      verdict: {
        declined: 'runtime-only',
        because: "resolved PolygonOccluder3D's polygon VALUE, occluder_instance_3d.cpp:713-714",
      },
    },
  ],

  VoxelGI: [
    {
      at: 'voxel_gi.cpp:544',
      says: 'not supported by the Compatibility renderer yet',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), voxel_gi.cpp:543' },
    },
    {
      at: 'voxel_gi.cpp:546',
      says: 'not supported by the Dummy renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), voxel_gi.cpp:545' },
    },
    {
      at: 'voxel_gi.cpp:548',
      says: 'no VoxelGI data set, so the node is disabled',
      verdict: { rule: 'voxelgi-missing-data' },
    },
  ],

  WorldEnvironment: [
    {
      at: 'world_environment.cpp:188',
      says: 'requires an Environment or a CameraAttributes resource to have any effect',
      verdict: { rule: 'worldenvironment-requires-environment' },
    },
    {
      at: 'world_environment.cpp:196',
      says: 'only the first Environment has an effect in a scene',
      verdict: { rule: 'single-worldenvironment' },
    },
    {
      at: 'world_environment.cpp:200',
      says: 'only one WorldEnvironment is allowed per scene',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D CameraAttributes, get_viewport()->find_world_3d()->get_camera_attributes(), world_environment.cpp:199",
      },
    },
    {
      at: 'world_environment.cpp:204',
      says: 'only the first Compositor has an effect in a scene',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D Compositor, get_viewport()->find_world_3d()->get_compositor(), world_environment.cpp:203",
      },
    },
  ],
};
