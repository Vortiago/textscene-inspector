const GAME_WINDOW = { width: 320, height: 180 };

export const IN_GAME_SCENES = [
  // The last current Camera3D, not the editor orbit, and no preview sun or sky.
  { name: 'in-game-camera3d', file: 'in-game/unit-in-game-camera3d.tscn', mode: 'in-game', canvas: GAME_WINDOW },
  // The Camera2D's offset moves the view, and a CanvasLayer bar stays at the top of the window.
  { name: 'in-game-camera2d', file: 'in-game/unit-in-game-camera2d.tscn', mode: 'in-game', canvas: GAME_WINDOW },
  // Host writes through the open scene: a transform, a light's energy and a material from `scene.load`.
  {
    name: 'in-game-writes-3d',
    file: 'in-game/unit-in-game-writes-3d.tscn',
    mode: 'in-game',
    canvas: GAME_WINDOW,
    sets: [
      { path: 'Group/Box', property: 'rotation', text: 'Vector3(0, -0.6, 0.3)' },
      { path: 'Omni', property: 'light_energy', text: '16.0' },
      { path: 'Group/Box', property: 'material_override', text: 'Resource("res://writes-red.tres")' },
    ],
  },
  // Host writes to the canvas: a Node2D, a Label's text, a Control's anchor and a texture from `scene.load`.
  {
    name: 'in-game-writes-2d',
    file: 'in-game/unit-in-game-writes-2d.tscn',
    mode: 'in-game',
    canvas: GAME_WINDOW,
    sets: [
      { path: 'Group', property: 'rotation', text: '-0.8' },
      { path: 'Score', property: 'text', text: '"Score: 10"' },
      { path: 'Panel', property: 'anchor_right', text: '0.5' },
      { path: 'Icon', property: 'texture', text: 'Resource("res://writes-yellow.png")' },
    ],
  },
  // A host write to a node inside an instance, which lands as an override heading below the instance.
  {
    name: 'in-game-writes-instance',
    file: 'in-game/unit-in-game-writes-instance.tscn',
    mode: 'in-game',
    canvas: GAME_WINDOW,
    sets: [{ path: 'Level/Group/Box', property: 'position', text: 'Vector3(1, 0.5, 1)' }],
  },
];
