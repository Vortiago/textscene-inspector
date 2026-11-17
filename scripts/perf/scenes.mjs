/**
 * Steps that can run many times a frame, and demos software GL draws at a frame a second or more.
 * @type {Array<{ name: string, file: string, inGameFrame?: { width: number, height: number } }>}
 */
export const BUDGET_SCENES = [
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  { name: 'fog-volume', file: 'unit-fog-volume.tscn' },
  { name: 'glow', file: 'unit-glow-strength.tscn' },
  { name: 'reflection-probe', file: 'unit-reflection-probe.tscn' },
  { name: 'pointlight2d', file: 'unit-pointlight2d-blend.tscn' },
  { name: 'modulate-200-sprites', file: 'perf-modulate-200-sprites.tscn' },
  { name: 'demo-3d-platformer', file: 'demos/3d/platformer/game.tscn' },
  { name: 'demo-2d-lights-and-shadows', file: 'demos/2d/lights_and_shadows/light_shadows.tscn' },
  {
    name: 'in-game-camera3d',
    file: 'in-game/unit-in-game-camera3d.tscn',
    inGameFrame: { width: 320, height: 180 },
  },
];
