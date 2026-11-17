/**
 * The In-game mode: the root viewport as the game starts it, at the game window of the fixture
 * project, through the scene's own camera, with no editor element.
 */

const GAME_WINDOW = { width: 320, height: 180 };

export const IN_GAME_SCENES = [
  // The last current Camera3D, not the editor orbit, and no preview sun or sky.
  { name: 'in-game-camera3d', file: 'in-game/unit-in-game-camera3d.tscn', mode: 'in-game', canvas: GAME_WINDOW },
  // The Camera2D's offset moves the view, and a CanvasLayer bar stays at the top of the window.
  { name: 'in-game-camera2d', file: 'in-game/unit-in-game-camera2d.tscn', mode: 'in-game', canvas: GAME_WINDOW },
];
