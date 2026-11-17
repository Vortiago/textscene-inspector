import { FRAMES_BEFORE_READ } from '../../../../scripts/godot-probes/godotRun.mjs';

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

/** One scene per non-default value: a light turned 180 degrees about Y puts its sun in view. */
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

/** A sky that shows `TIME` in red and green, a step of 1/8 s apart in green. */
const TIME_SKY = `shader_type sky;

void sky() {
	COLOR = vec3(TIME * 0.5, fract(TIME * 4.0), 0.25);
}
`;

/** The showcase's animated sky, which the slice's video records frame by frame beside Godot. */
const TIME_CYCLE_SKY = `shader_type sky;

void sky() {
	vec3 phase = vec3(0.0, 2.0, 4.0);
	COLOR = 0.5 + 0.5 * cos(TIME * vec3(1.0, 1.3, 1.7) * 2.0 + phase);
	COLOR *= 0.75 + 0.25 * step(0.5, fract(TIME));
}
`;

/** `TIME` after the frames a run draws before it reads: at 0, at a fraction, and past the rollover. */
const TIME_SCENES = [
  { name: 'sky-time-zero', clock: { fixedFps: 8, rolloverSeconds: 0.125 } },
  { name: 'sky-time-fraction', clock: { fixedFps: 3, rolloverSeconds: 3600 } },
  { name: 'sky-time-rolled-over', clock: { fixedFps: 3, rolloverSeconds: 1.2 } },
  { name: 'sky-time-cycle', source: TIME_CYCLE_SKY, clock: { fixedFps: 3, rolloverSeconds: 3600 } },
].map((scene) => ({
  ...SIZE,
  source: TIME_SKY,
  camera: AHEAD,
  lights: [],
  rows: ['sky.global.TIME'],
  ...scene,
  clock: { ...scene.clock, frames: FRAMES_BEFORE_READ },
}));

/** A sky of one stage built-in, drawn with `body` as its `sky()` function. */
const builtInSky = (body, renderModes = '') =>
  `shader_type sky;\n${renderModes ? `render_mode ${renderModes};\n` : ''}\nvoid sky() {\n${body}\n}\n`;

/** A camera turned and lifted off the origin, so that each built-in that reads it moves. */
const TURNED = { fov: 75, rotation: [20, -35, 0], position: [1.3, 2.1, -0.7] };

/** One scene per built-in of the sky stage, each read into the colour, against Godot's image. */
const BUILT_IN_SCENES = [
  { name: 'sky-eyedir', source: builtInSky('\tCOLOR = EYEDIR * 0.5 + 0.5;'), rows: ['sky.sky.EYEDIR'] },
  {
    name: 'sky-coords',
    source: builtInSky('\tCOLOR = vec3(SKY_COORDS, 0.25);'),
    rows: ['sky.sky.SKY_COORDS'],
  },
  {
    name: 'sky-screen-uv',
    source: builtInSky('\tCOLOR = vec3(SCREEN_UV, 0.25);'),
    rows: ['sky.sky.SCREEN_UV'],
  },
  {
    name: 'sky-fragcoord',
    source: builtInSky('\tCOLOR = vec3(fract(FRAGCOORD.xy / 16.0), FRAGCOORD.z);'),
    rows: ['sky.sky.FRAGCOORD'],
  },
  {
    name: 'sky-position',
    source: builtInSky('\tCOLOR = fract(POSITION * 0.37);'),
    rows: ['sky.global.POSITION'],
  },
  {
    name: 'sky-constants',
    source: builtInSky('\tCOLOR = vec3(PI / 4.0, TAU / 8.0, E / 3.0) * (0.5 + 0.5 * EYEDIR.y);'),
    rows: ['sky.constants.PI', 'sky.constants.TAU', 'sky.constants.E', 'sky.sky.EYEDIR'],
  },
  {
    name: 'sky-fog-write',
    source: builtInSky(
      '\tCOLOR = vec3(0.1, 0.2, 0.8);\n\tFOG = vec4(1.0, 0.3, 0.1, 0.6 * max(EYEDIR.y, 0.0));'
    ),
    fog: FOG,
    rows: ['sky.sky.FOG', 'sky.sky.EYEDIR'],
  },
  {
    name: 'sky-disable-fog',
    source: builtInSky('\tCOLOR = vec3(0.1, 0.2, 0.8);', 'disable_fog'),
    fog: FOG,
    rows: ['sky render_mode disable_fog'],
  },
  {
    name: 'sky-debanding',
    source: builtInSky('\tCOLOR = vec3(0.002);', 'use_debanding'),
    rows: ['sky render_mode use_debanding'],
  },
].map((scene) => ({ ...SIZE, camera: TURNED, lights: [], ...scene }));

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
  ...TIME_SCENES,
  ...BUILT_IN_SCENES,
];
