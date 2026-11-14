/**
 * The end to end sky scenes: each one a sky shader drawn as a 3D viewport's background, with a
 * camera, the environment's fog and its directional lights. Godot draws each scene, a plain
 * three.js page draws the transpiled sky with the same values, and the run compares the images.
 * The rows a scene names are transpiled when it matches Godot.
 */

/** Godot's default sky shader (`sky.cpp:807`). */
export const DEFAULT_SKY = `shader_type sky;

void sky() {
	COLOR = vec3(0.0);
}
`;

/** The rows of Godot's default sky shader. */
const DEFAULT_SKY_ROWS = ['shader_type', 'shader_type sky', 'NODE_TYPE_SHADER', 'sky.sky.COLOR'];

const SIZE = { width: 64, height: 64, chapter: 'sky.md' };

/** A camera that looks along -Z, as both engines' cameras do, with Godot's default vertical field of view. */
const AHEAD = { fov: 75, rotation: [0, 0, 0] };

const SUN = { rotation: [-20, 10, 0], color: [1, 0.9, 0.7], energy: 1.5, size: 0.5 };

export const SKY_SCENES = [
  { name: 'sky-default', ...SIZE, source: DEFAULT_SKY, camera: AHEAD, lights: [], rows: DEFAULT_SKY_ROWS },
  {
    name: 'sky-fog',
    ...SIZE,
    source: DEFAULT_SKY,
    camera: AHEAD,
    fog: { color: [0.5, 0.6, 0.7], energy: 1, sunScatter: 0, skyAffect: 0.75, aerialPerspective: 0.25 },
    lights: [],
    rows: DEFAULT_SKY_ROWS,
  },
  {
    name: 'sky-fog-sun',
    ...SIZE,
    source: DEFAULT_SKY,
    camera: { fov: 75, rotation: [-15, 20, 0] },
    fog: { color: [0.3, 0.35, 0.4], energy: 1.2, sunScatter: 0.6, skyAffect: 1, aerialPerspective: 0 },
    lights: [SUN, { rotation: [-60, -120, 0], color: [0.4, 0.6, 1], energy: 0.8, size: 2 }],
    rows: DEFAULT_SKY_ROWS,
  },
];
