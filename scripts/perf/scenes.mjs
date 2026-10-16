/**
 * The scenes whose work the budget check holds: one per render step that can run many times in a
 * frame, and larger demo scenes that run several steps together. A demo joins only when software GL
 * draws it at a frame or more a second: the 3D lights and material tester demos take seconds a frame. `name` keys the scene's entry in
 * budgets.json. `file` means what it means in scripts/visual/scenes.mjs.
 */
export const BUDGET_SCENES = [
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  { name: 'fog-volume', file: 'unit-fog-volume.tscn' },
  { name: 'glow', file: 'unit-glow-strength.tscn' },
  { name: 'reflection-probe', file: 'unit-reflection-probe.tscn' },
  { name: 'pointlight2d', file: 'unit-pointlight2d-blend.tscn' },
  { name: 'demo-3d-platformer', file: 'demos/3d/platformer/game.tscn' },
  { name: 'demo-2d-lights-and-shadows', file: 'demos/2d/lights_and_shadows/light_shadows.tscn' },
];
