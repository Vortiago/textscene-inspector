/**
 * @type {Array<{ name: string, file: string, inGameFrame?: { width: number, height: number },
 *   writesEachFrame?: { parent: string, count: number } }>}
 */
export const BUDGET_SCENES = [
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  { name: 'fog-volume', file: 'unit-fog-volume.tscn' },
  { name: 'sun-soft-shadow', file: 'sun-soft-shadow/unit-spatial-shader-lit-sun-soft-shadow.tscn' },
  { name: 'glow', file: 'unit-glow-strength.tscn' },
  { name: 'reflection-probe', file: 'unit-reflection-probe.tscn' },
  { name: 'pointlight2d', file: 'unit-pointlight2d-blend.tscn' },
  { name: 'modulate-200-sprites', file: 'perf-modulate-200-sprites.tscn' },
  { name: 'demo-3d-platformer', file: 'demos/3d/platformer/game.tscn' },
  {
    name: 'demo-3d-platformer-write-each-frame',
    file: 'demos/3d/platformer/game.tscn',
    writesEachFrame: { parent: 'Coins', count: 1 },
  },
  { name: 'demo-2d-lights-and-shadows', file: 'demos/2d/lights_and_shadows/light_shadows.tscn' },
  {
    name: 'in-game-camera3d',
    file: 'in-game/unit-in-game-camera3d.tscn',
    inGameFrame: { width: 320, height: 180 },
  },
  {
    name: 'in-game-hud-over-world',
    file: 'in-game/unit-in-game-hud-over-world.tscn',
    inGameFrame: { width: 320, height: 180 },
  },
];
