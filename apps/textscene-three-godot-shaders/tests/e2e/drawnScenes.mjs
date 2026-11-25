import { CANVAS_SCENES } from './canvasScenes.mjs';
import { MESH_SCENES } from './meshScenes.mjs';
import { SHOWCASES } from './showcases.mjs';
import { SKY_SCENES } from './skyScenes.mjs';

/** Each scene of the end-to-end run, with the page's function that draws it. */
export const DRAWN_SCENES = [
  ...SHOWCASES.map((spec) => ({ spec, draw: 'drawShowcase' })),
  ...SKY_SCENES.map((spec) => ({ spec, draw: 'drawSky' })),
  ...MESH_SCENES.map((spec) => ({ spec, draw: 'drawMesh' })),
  ...CANVAS_SCENES.map((spec) => ({ spec, draw: 'drawCanvas' })),
];

export const ALL_SCENES = DRAWN_SCENES.map(({ spec }) => spec);
