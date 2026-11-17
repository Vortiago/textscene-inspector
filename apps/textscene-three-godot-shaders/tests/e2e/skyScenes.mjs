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

/** A sky whose three channels each wrap at another rate, so no `TIME` up to 8 s saturates it. */
const SEEK_SKY = `shader_type sky;

void sky() {
	COLOR = vec3(fract(TIME * 0.37), fract(TIME * 4.0), TIME / 8.0);
}
`;

/** The previewer's `TIME` after a seek to the time Godot's frames reach, also past a rollover. */
const SEEK_SCENES = [
  { name: 'sky-time-seek-half', clock: { fixedFps: 8, rolloverSeconds: 3600 } },
  { name: 'sky-time-seek-third', clock: { fixedFps: 3, rolloverSeconds: 3600 } },
  { name: 'sky-time-seek-four', clock: { fixedFps: 1, rolloverSeconds: 3600 } },
  { name: 'sky-time-seek-rolled-over', clock: { fixedFps: 1, rolloverSeconds: 1.5 } },
  { name: 'sky-time-seek-third-rolled-over', clock: { fixedFps: 3, rolloverSeconds: 1.2 } },
].map((scene) => ({
  ...SIZE,
  source: SEEK_SKY,
  camera: AHEAD,
  lights: [],
  rows: ['sky.global.TIME'],
  ...scene,
  clock: { ...scene.clock, frames: FRAMES_BEFORE_READ, fromSeek: true },
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

/** Four suns of distinct colour, energy, size and direction, one for each slot a sky reads. */
const FOUR_SUNS = [
  { rotation: [-20, 150, 0], color: [1, 0.6, 0.3], energy: 1.5, size: 2 },
  { rotation: [-45, -160, 0], color: [0.3, 1, 0.5], energy: 0.7, size: 5 },
  { rotation: [-10, 120, 0], color: [0.4, 0.5, 1], energy: 2.5, size: 1 },
  { rotation: [-70, 200, 0], color: [1, 0.2, 0.8], energy: 0.4, size: 9 },
];

/** Every light built-in of slot `n`, each in its own term of the colour. */
const lightSky = (n) =>
  builtInSky(
    [
      `\tfloat facing = max(dot(EYEDIR, LIGHT${n}_DIRECTION), 0.0);`,
      `\tCOLOR = LIGHT${n}_COLOR * LIGHT${n}_ENERGY * 0.4 * facing + vec3(LIGHT${n}_SIZE * 0.25);`,
      `\tCOLOR *= LIGHT${n}_ENABLED ? 1.0 : 0.25;`,
    ].join('\n')
  );

const lightRows = (n) =>
  ['ENABLED', 'DIRECTION', 'ENERGY', 'COLOR', 'SIZE'].map((name) => `sky.global.LIGHT${n}_${name}`);

/** A camera that looks back along +Z, where the suns of `FOUR_SUNS` shine from. */
const BACK = { fov: 90, rotation: [15, 180, 0] };

/** One scene per light slot, then a slot past the lights and a fifth light the sky does not read. */
const LIGHT_SCENES = [
  ...[0, 1, 2, 3].map((n) => ({
    name: `sky-light-${n}`,
    source: lightSky(n),
    lights: FOUR_SUNS,
    rows: lightRows(n),
  })),
  // Godot leaves a slot past the last light as it was, so only its `ENABLED` is defined (`sky.cpp:1107-1111`).
  {
    name: 'sky-light-unset',
    source: builtInSky('\tCOLOR = LIGHT1_ENABLED ? vec3(0.1, 0.8, 0.2) : vec3(0.8, 0.1, 0.1);'),
    lights: FOUR_SUNS.slice(0, 1),
    rows: ['sky.global.LIGHT1_ENABLED'],
  },
  {
    name: 'sky-light-fifth',
    source: lightSky(3),
    lights: [...FOUR_SUNS, { rotation: [-30, 170, 0], color: [1, 1, 1], energy: 8, size: 3 }],
    rows: lightRows(3),
  },
].map((scene) => ({ ...SIZE, camera: BACK, ...scene }));

/** Godot's resolution passes, each read by the next: the quarter, the half, then the full pass. */
const PASS_SCENES = [
  {
    name: 'sky-half-res',
    source: builtInSky(
      [
        '\tif (AT_HALF_RES_PASS) {',
        '\t\tCOLOR = EYEDIR * 0.5 + 0.5;',
        '\t} else {',
        '\t\tCOLOR = HALF_RES_COLOR.rgb * vec3(1.0, 0.8, 0.6) + vec3(0.0, 0.0, 0.2);',
        '\t}',
      ].join('\n'),
      'use_half_res_pass'
    ),
    rows: ['sky.global.AT_HALF_RES_PASS', 'sky.sky.HALF_RES_COLOR', 'sky render_mode use_half_res_pass'],
  },
  {
    name: 'sky-quarter-res',
    source: builtInSky(
      [
        '\tif (AT_QUARTER_RES_PASS) {',
        '\t\tCOLOR = vec3(fract(FRAGCOORD.xy / 4.0), SCREEN_UV.x);',
        '\t} else if (AT_HALF_RES_PASS) {',
        '\t\tCOLOR = mix(QUARTER_RES_COLOR.rgb, EYEDIR * 0.5 + 0.5, 0.5);',
        '\t} else {',
        '\t\tCOLOR = HALF_RES_COLOR.rgb;',
        '\t}',
      ].join('\n'),
      'use_half_res_pass, use_quarter_res_pass'
    ),
    rows: [
      'sky.global.AT_QUARTER_RES_PASS',
      'sky.sky.QUARTER_RES_COLOR',
      'sky render_mode use_quarter_res_pass',
      'sky.sky.FRAGCOORD',
    ],
  },
  {
    name: 'sky-quarter-res-alone',
    source: builtInSky(
      '\tCOLOR = AT_QUARTER_RES_PASS ? EYEDIR * 0.5 + 0.5 : QUARTER_RES_COLOR.rgb * HALF_RES_COLOR.rgb;',
      'use_quarter_res_pass'
    ),
    rows: ['sky.global.AT_QUARTER_RES_PASS', 'sky.sky.QUARTER_RES_COLOR', 'sky.sky.HALF_RES_COLOR'],
  },
  {
    name: 'sky-half-res-unset',
    source: builtInSky('\tCOLOR = HALF_RES_COLOR.rgb * QUARTER_RES_COLOR.rgb * vec3(0.9, 0.6, 0.3);'),
    rows: ['sky.sky.HALF_RES_COLOR', 'sky.sky.QUARTER_RES_COLOR'],
  },
  {
    name: 'sky-cubemap-pass',
    source: builtInSky('\tCOLOR = AT_CUBEMAP_PASS ? vec3(1.0, 0.0, 0.0) : vec3(0.1, 0.7, 0.3);'),
    rows: ['sky.global.AT_CUBEMAP_PASS'],
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
  ...SEEK_SCENES,
  ...BUILT_IN_SCENES,
  ...LIGHT_SCENES,
  ...PASS_SCENES,
];
