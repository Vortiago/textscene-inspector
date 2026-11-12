/** CPUParticles2D. */

export const PARTICLES_2D_SCENES = [
  // CPUParticles2D renders a frozen pose: a live emitter never gives two
  // identical frames, so the harness fails it as unstable, not as changed. Each
  // fixture pins `use_fixed_seed`/`seed`/`fixed_fps`/`preprocess` so the pose
  // is one exact draw.
  { name: 'cpuparticles2d', file: 'unit-cpuparticles2d.tscn' },
  { name: 'cpuparticles2d-emission-shapes', file: 'unit-cpuparticles2d-emission-shapes.tscn' },
  // One point, its normal and its colour: the velocity turns along the normal (cpu_particles_2d.cpp:940-946).
  { name: 'cpuparticles2d-directed-points', file: 'unit-cpuparticles2d-directed-points.tscn' },
  // A RING fills the band between its radii, in other places than Godot's unsaved RNG picks.
  { name: 'cpuparticles2d-ring', file: 'unit-cpuparticles2d-ring.tscn' },
  { name: 'cpuparticles2d-curves', file: 'unit-cpuparticles2d-curves.tscn' },
  // The same scene with both Curves in a `.tres`: it must match the inline one.
  { name: 'cpuparticles2d-curves-file', file: 'unit-cpuparticles2d-curves-file.tscn' },
  { name: 'cpuparticles2d-split-scale', file: 'unit-cpuparticles2d-split-scale.tscn' },
  // A crossed `_min`/`_max` pair and a lone `_min` load as Godot's paired setters leave them:
  // 100 and 100 for the velocity, 6 and 6 for the scale.
  { name: 'cpuparticles2d-crossed-range', file: 'unit-cpuparticles2d-crossed-range.tscn' },
  { name: 'cpuparticles2d-color-ramp', file: 'unit-cpuparticles2d-color-ramp.tscn' },
  // The same scene with both Gradients in a `.tres`: it must match the inline one.
  { name: 'cpuparticles2d-color-ramp-file', file: 'unit-cpuparticles2d-color-ramp-file.tscn' },
  // A scaled emitter whose particles must not scale with it: Godot's default
  // `local_coords = false` emits into world space.
  { name: 'cpuparticles2d-local-coords', file: 'unit-cpuparticles2d-local-coords.tscn' },
  // `emitting = false` draws nothing. Script-triggered one-shot emitters ship
  // this way, so a regression that started drawing them would be widespread.
  { name: 'cpuparticles2d-not-emitting', file: 'unit-cpuparticles2d-not-emitting.tscn' },
  // The one emitter with no `preprocess`, so the previewer substitutes its
  // instant. Its lifetime is not a multiple of the step, so the settle's
  // whole-frame overshoot is in the picture. Compare with Godot through
  // `--particles 0.95`, the command in the fixture header.
  { name: 'cpuparticles2d-unpreprocessed', file: 'unit-cpuparticles2d-unpreprocessed.tscn' },
  // The one emitter that does not pin its seed, so it exercises the substituted
  // one. Godot cannot draw this scene the same way twice. The previewer must,
  // and this baseline records our pose, which no reference can arbitrate.
  { name: 'cpuparticles2d-unseeded', file: 'unit-cpuparticles2d-unseeded.tscn' },
  // A global-coords emitter's rotation leaves the normal, a local one's turns it. Godot 4.6.3
  // `--mode 2d`: Global rgb(226) at (100,324), Local rgb(161) at (852,324) and rgb(226) at (952,224).
  { name: 'cpuparticles2d-normal-map', file: 'unit-cpuparticles2d-normal-map.tscn', mode: '2d' },
];
