/** Close enough that a few lights fill the view, where the 2D light pass costs most per frame. */
const DUNGEON_ZOOM_NOTCHES = 12;

/**
 * @type {Array<{ name: string, file: string, inGameFrame?: { width: number, height: number },
 *   writesEachFrame?: { parent: string, count: number }, zoomNotches?: number,
 *   gesture?: keyof typeof import('./cameraGestures.mjs').CAMERA_GESTURES }>}
 */
export const BUDGET_SCENES = [
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  { name: 'fog-volume', file: 'unit-fog-volume.tscn' },
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
  { name: 'dungeon-pan', file: 'dungeon.tscn', gesture: 'pan-2d' },
  { name: 'dungeon-zoom', file: 'dungeon.tscn', gesture: 'zoom-2d' },
  { name: 'dungeon-zoomed-in', file: 'dungeon.tscn', zoomNotches: DUNGEON_ZOOM_NOTCHES },
  {
    name: 'dungeon-zoomed-in-pan',
    file: 'dungeon.tscn',
    zoomNotches: DUNGEON_ZOOM_NOTCHES,
    gesture: 'pan-2d',
  },
  { name: 'depth-fog-orbit', file: 'unit-depth-fog.tscn', gesture: 'orbit-3d' },
  { name: 'depth-fog-pan', file: 'unit-depth-fog.tscn', gesture: 'pan-3d' },
  { name: 'depth-fog-zoom', file: 'unit-depth-fog.tscn', gesture: 'zoom-3d' },
  { name: 'depth-fog-freelook', file: 'unit-depth-fog.tscn', gesture: 'freelook-3d' },
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
