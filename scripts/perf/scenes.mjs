/**
 * @type {Array<{ name: string, file: string, inGameFrame?: { width: number, height: number },
 *   writesEachFrame?: { parent: string, count: number }, canvasItem?: 'translated' }>}
 */
export const BUDGET_SCENES = [
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  { name: 'fog-volume', file: 'unit-fog-volume.tscn' },
  { name: 'sun-soft-shadow', file: 'sun-soft-shadow/unit-spatial-shader-lit-sun-soft-shadow.tscn' },
  {
    name: 'sun-soft-shadow-hard-twin',
    file: 'sun-soft-shadow/unit-spatial-shader-lit-sun-hard-shadow-twin.tscn',
  },
  { name: 'glow', file: 'unit-glow-strength.tscn' },
  { name: 'reflection-probe', file: 'unit-reflection-probe.tscn' },
  { name: 'pointlight2d', file: 'unit-pointlight2d-blend.tscn' },
  { name: 'pointlight2d-translated', file: 'unit-pointlight2d-blend.tscn', canvasItem: 'translated' },
  { name: 'modulate-200-sprites', file: 'perf-modulate-200-sprites.tscn' },
  { name: 'demo-3d-platformer', file: 'demos/3d/platformer/game.tscn' },
  {
    name: 'demo-3d-platformer-write-each-frame',
    file: 'demos/3d/platformer/game.tscn',
    writesEachFrame: { parent: 'Coins', count: 1 },
  },
  { name: 'canvas-item-instances', file: 'unit-canvas-item-translated-instances.tscn' },
  {
    name: 'canvas-item-instances-translated',
    file: 'unit-canvas-item-translated-instances.tscn',
    canvasItem: 'translated',
  },
  { name: 'demo-2d-lights-and-shadows', file: 'demos/2d/lights_and_shadows/light_shadows.tscn' },
  { name: 'dungeon', file: 'dungeon.tscn' },
  { name: 'dungeon-translated', file: 'dungeon.tscn', canvasItem: 'translated' },
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
