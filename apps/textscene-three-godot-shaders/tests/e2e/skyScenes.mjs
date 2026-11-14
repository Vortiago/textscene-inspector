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

/** A fog of Godot's default values but its colour, which the scenes below change one field at a time. */
const FOG = { color: [0.8, 0.5, 0.3], energy: 1, sunScatter: 0, skyAffect: 1, aerialPerspective: 0 };

/**
 * Each non-default value the default sky reads, one scene each, so a wrong value shows in its own
 * scene. A light turned 180 degrees about Y shines towards the camera, so its sun is in view.
 */
const VALUE_SCENES = [
  { name: 'sky-fog-energy-0', fog: { ...FOG, energy: 0 } },
  { name: 'sky-fog-energy-3', fog: { ...FOG, energy: 3 } },
  { name: 'sky-fog-affect-0', fog: { ...FOG, skyAffect: 0 } },
  { name: 'sky-fog-affect-half', fog: { ...FOG, skyAffect: 0.5, aerialPerspective: 0.5 } },
  {
    name: 'sky-sun-coloured',
    camera: { fov: 75, rotation: [10, 0, 0] },
    fog: { ...FOG, sunScatter: 1 },
    lights: [{ rotation: [-10, 180, 0], color: [1, 0.2, 0.1], energy: 2.5, size: 4 }],
  },
  {
    name: 'sky-sun-below',
    camera: { fov: 75, rotation: [-40, 0, 0] },
    fog: { ...FOG, sunScatter: 1 },
    lights: [{ rotation: [30, 180, 0], color: [1, 1, 1], energy: 1, size: 8 }],
  },
  {
    name: 'sky-sun-energy-0',
    fog: { ...FOG, sunScatter: 1 },
    lights: [{ rotation: [-5, 180, 0], color: [1, 1, 1], energy: 0, size: 8 }],
  },
  {
    name: 'sky-camera-wide',
    camera: { fov: 120, rotation: [45, -30, 0] },
    fog: { ...FOG, sunScatter: 0.5, aerialPerspective: 0.5 },
    lights: [
      { rotation: [-50, -20, 0], color: [0.3, 1, 0.4], energy: 1.5, size: 3 },
      { rotation: [-20, 160, 0], color: [1, 0.8, 0.2], energy: 0.6, size: 1 },
    ],
  },
].map((scene) => ({
  ...SIZE,
  source: DEFAULT_SKY,
  camera: AHEAD,
  lights: [],
  rows: DEFAULT_SKY_ROWS,
  ...scene,
}));

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
  ...VALUE_SCENES,
];
