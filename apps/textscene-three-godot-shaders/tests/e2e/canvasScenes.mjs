/** Godot's default canvas shader, for an item with no material (`renderer_canvas_render_rd.cpp:1762`). */
export const DEFAULT_CANVAS = 'shader_type canvas_item;\n';

const SIZE = { width: 64, height: 48, chapter: 'canvas.md' };

/** Texels of distinct colours, so a region, a flip or a transpose shows which texel lands where. */
function gridTexture(width, height, alphaOf = () => 255) {
  const texels = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      texels.push([16 + x * 28, 24 + y * 52, (x + y) % 2 ? 230 : 40, alphaOf(x, y)]);
  return { width, height, texels };
}

const GRID = gridTexture(8, 4);

/** The grid with alpha falling from 1 at the left to 0 at the right. */
const FADING_GRID = gridTexture(8, 4, (x) => Math.round(255 - (x * 255) / 7));

const WHITE = [1, 1, 1, 1];

/** A root item at `position`, with no turn, scale or modulate. */
const placedAt = (position) => ({
  position,
  rotation: 0,
  scale: [1, 1],
  modulate: WHITE,
  selfModulate: WHITE,
});

const CENTRE = placedAt([32, 24]);

/** The whole grid four times its size, centred on the item, as a centred Sprite2D draws it. */
const WHOLE_GRID = {
  rect: [-16, -8, 32, 16],
  source: [0, 0, 8, 4],
  modulate: WHITE,
  transpose: false,
  clipUv: false,
};

/** One scene of rects of `texture` on an item, with Godot's default viewport and canvas. */
const rectScene = (name, fields) => ({
  name,
  ...SIZE,
  source: DEFAULT_CANVAS,
  texture: GRID,
  filter: 'nearest',
  repeat: 'disabled',
  item: CENTRE,
  rects: [WHOLE_GRID],
  canvasTransform: [1, 0, 0, 1, 0, 0],
  canvasModulate: WHITE,
  snapVertices: false,
  ...fields,
});

const rect = (fields) => ({ ...WHOLE_GRID, ...fields });

export const CANVAS_SCENES = [
  rectScene('canvas-rect-texture', {}),
  rectScene('canvas-rect-region', { rects: [rect({ rect: [-12, -12, 24, 24], source: [2, 1, 3, 3] })] }),
  rectScene('canvas-rect-flip-h', { rects: [rect({ rect: [-16, -8, -32, 16] })] }),
  rectScene('canvas-rect-flip-v', { rects: [rect({ rect: [-16, -8, 32, -16] })] }),
  rectScene('canvas-rect-flip-source', { rects: [rect({ source: [0, 0, -8, -4] })] }),
  rectScene('canvas-rect-transposed', { rects: [rect({ rect: [-16, -8, 16, 32], transpose: true })] }),
  rectScene('canvas-rect-modulate', { rects: [rect({ modulate: [1, 0.5, 0.25, 1] })] }),
  rectScene('canvas-rect-modulate-over-1', {
    item: { ...CENTRE, modulate: [2, 1.5, 0.5, 1], selfModulate: [1.5, 1, 1, 1] },
  }),
  rectScene('canvas-rect-modulate-alpha-0', { item: { ...CENTRE, modulate: [1, 1, 1, 0] } }),
  rectScene('canvas-rect-self-modulate-alpha', {
    texture: FADING_GRID,
    item: { ...CENTRE, selfModulate: [0.8, 1, 0.6, 0.5] },
  }),
  rectScene('canvas-rect-blend-alpha', { texture: FADING_GRID }),
  rectScene('canvas-rect-linear', { filter: 'linear' }),
  rectScene('canvas-rect-linear-clip-uv', {
    filter: 'linear',
    rects: [rect({ rect: [-24, -12, 48, 24], source: [2, 1, 4, 2], clipUv: true })],
  }),
  rectScene('canvas-rect-linear-no-clip', {
    filter: 'linear',
    rects: [rect({ rect: [-24, -12, 48, 24], source: [2, 1, 4, 2] })],
  }),
  rectScene('canvas-rect-repeat', {
    repeat: 'enabled',
    rects: [rect({ rect: [-24, -16, 48, 32], source: [-4, -2, 24, 8] })],
  }),
  rectScene('canvas-rect-mirror', {
    repeat: 'mirror',
    rects: [rect({ rect: [-24, -16, 48, 32], source: [-4, -2, 24, 8] })],
  }),
  rectScene('canvas-rect-clamp', { rects: [rect({ rect: [-24, -16, 48, 32], source: [-4, -2, 24, 8] })] }),
  rectScene('canvas-rect-rotated', { item: { ...CENTRE, rotation: 30, scale: [1.25, 0.75] } }),
  rectScene('canvas-rect-rotated-linear', {
    filter: 'linear',
    item: { ...CENTRE, rotation: -50, scale: [1, 1.5] },
  }),
  // Linear, as a snapped edge covers the pixel centres an unsnapped one covers, and only the UV moves.
  rectScene('canvas-rect-subpixel', { filter: 'linear', item: placedAt([32.3, 24.6]) }),
  rectScene('canvas-rect-subpixel-snapped', {
    filter: 'linear',
    item: placedAt([32.3, 24.6]),
    snapVertices: true,
  }),
  rectScene('canvas-rect-canvas-transform', { canvasTransform: [1.5, 0, 0, 0.75, -10, 6] }),
  rectScene('canvas-rect-canvas-modulate', { canvasModulate: [0.5, 1, 0.75, 1] }),
  rectScene('canvas-rect-batch', {
    rects: [
      rect({ rect: [-30, -20, 16, 8], source: [0, 0, 4, 2] }),
      rect({ rect: [-10, -6, 24, 12], modulate: [0.4, 1, 1, 0.7] }),
      rect({ rect: [14, 4, -16, 16], source: [4, 2, 4, 2] }),
    ],
  }),
];
