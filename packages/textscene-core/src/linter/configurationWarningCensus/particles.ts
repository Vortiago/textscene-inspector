/**
 * CPU and GPU particle nodes, and the SDF collision baker.
 *
 * `GPUParticles3D` is the largest single override in the census: nine rows, of
 * which the trail set is decided from the mesh and skin resources a scene only
 * references.
 */
import type { WarningRow } from './types.js';

export const particleWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  CPUParticles2D: [
    {
      at: 'cpu_particles_2d.cpp:307',
      says: 'animation requires a CanvasItemMaterial with Particles Animation enabled',
      verdict: {
        declined: 'runtime-only',
        because: "resolved material's particles_animation VALUE, cpu_particles_2d.cpp:302,304",
      },
    },
  ],

  CPUParticles3D: [
    {
      at: 'cpu_particles_3d.cpp:234',
      says: 'nothing is visible because no mesh has been assigned',
      verdict: { rule: 'cpuparticles3d-requires-mesh' },
    },
    {
      at: 'cpu_particles_3d.cpp:238',
      says: 'animation requires a StandardMaterial3D with Particle Billboard mode',
      verdict: {
        declined: 'runtime-only',
        because: "resolved material's billboard-mode VALUE, cpu_particles_3d.cpp:215-238",
      },
    },
  ],

  GPUParticles2D: [
    {
      at: 'gpu_particles_2d.cpp:377',
      says: 'no material to process the particles is assigned',
      verdict: { rule: 'gpuparticles2d-missing-process-material' },
    },
    {
      at: 'gpu_particles_2d.cpp:386',
      says: 'animation requires a CanvasItemMaterial with Particles Animation enabled',
      verdict: {
        declined: 'runtime-only',
        because: "material and process_material property VALUES, gpu_particles_2d.cpp:379-385",
      },
    },
    {
      at: 'gpu_particles_2d.cpp:392',
      says: 'particle trails only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_2d.cpp:391' },
    },
    {
      at: 'gpu_particles_2d.cpp:396',
      says: 'particle sub-emitters only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_2d.cpp:395' },
    },
  ],

  GPUParticles3D: [
    {
      at: 'gpu_particles_3d.cpp:363',
      says: 'nothing is visible because meshes have not been assigned to draw passes',
      verdict: { rule: 'gpuparticles3d-no-draw-pass-mesh' },
    },
    {
      at: 'gpu_particles_3d.cpp:367',
      says: 'no material to process the particles is assigned',
      verdict: { rule: 'gpuparticles3d-missing-process-material' },
    },
    {
      at: 'gpu_particles_3d.cpp:373',
      says: 'animation requires a BaseMaterial3D with Particle Billboard mode',
      verdict: { declined: 'runtime-only', because: "resolved material's billboard-mode VALUE, gpu_particles_3d.cpp:370-372" },
    },
    {
      at: 'gpu_particles_3d.cpp:415',
      says: 'Trail meshes with a Skin causes the Skin to override Trail poses',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass/skin CONTENT, gpu_particles_3d.cpp:414' },
    },
    {
      at: 'gpu_particles_3d.cpp:417',
      says: 'Trails active, but neither Trail meshes nor a Skin were found',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass/skin CONTENT, gpu_particles_3d.cpp:416' },
    },
    {
      at: 'gpu_particles_3d.cpp:419',
      says: 'only one Trail mesh is supported without a Skin',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass count, gpu_particles_3d.cpp:418' },
    },
    {
      at: 'gpu_particles_3d.cpp:423',
      says: 'Trails enabled, but one or more mesh materials are missing or unset for trails',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass materials CONTENT, gpu_particles_3d.cpp:422' },
    },
    {
      at: 'gpu_particles_3d.cpp:426',
      says: 'particle trails only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_3d.cpp:425' },
    },
    {
      at: 'gpu_particles_3d.cpp:431',
      says: 'particle sub-emitters only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_3d.cpp:430' },
    },
  ],

  GPUParticlesCollisionSDF3D: [
    {
      at: 'gpu_particles_collision_3d.cpp:530',
      says: 'Bake Mask has no bits enabled, so baking produces no collision',
      verdict: { rule: 'gpuparticlescollisionsdf3d-empty-bake-mask' },
    },
  ],
};
