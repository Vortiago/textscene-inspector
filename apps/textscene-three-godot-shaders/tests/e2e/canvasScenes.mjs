import { FRAMES_BEFORE_READ } from '../../../../scripts/godot-probes/godotRun.mjs';

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

/** The grid with its channels turned, so a map shows apart from the diffuse and the other map. */
const turnedGrid = (turn) => ({ ...GRID, texels: GRID.texels.map(turn) });

/** A CanvasTexture over the grid, with maps of their own texels and a shininess that turns specular on. */
const GRID_MAPS = {
  normal: turnedGrid(([r, g, b, a]) => [b, r, g, a]),
  specular: turnedGrid(([r, g, b, a]) => [g, b, r, a]),
  specularColor: [0.5, 0.25, 1, 1],
  shininess: 0.5,
};

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

/** One scene of `kind` on an item, with Godot's default viewport and canvas, on an sRGB target. */
const canvasScene = (kind, name, fields) => ({
  name,
  kind,
  ...SIZE,
  source: DEFAULT_CANVAS,
  texture: GRID,
  filter: 'nearest',
  repeat: 'disabled',
  item: CENTRE,
  canvasTransform: [1, 0, 0, 1, 0, 0],
  canvasModulate: WHITE,
  snapVertices: false,
  linear: false,
  ...fields,
});

/** One scene of rects of `texture` on an item: `draw_texture_rect_region`. */
const rectScene = (name, fields) => canvasScene('rect', name, { rects: [WHOLE_GRID], ...fields });

const rect = (fields) => ({ ...WHOLE_GRID, ...fields });

const RECT_SCENES = [
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

const RED = [1, 0, 0, 1];
const GREEN = [0, 1, 0, 1];
const BLUE = [0, 0, 1, 1];
const YELLOW = [1, 1, 0, 0.5];

/** Points at pixel centres, so a point or a line covers the same pixels on every rasteriser. */
const centre = ([x, y]) => [x + 0.5, y + 0.5];

/** One scene of `draw_primitive` calls on the item, each `{ points, colors, uvs }`, all textured or none. */
const primitiveScene = (name, primitives, fields = {}) =>
  canvasScene('primitive', name, { primitives, isTextured: false, ...fields });

/** A quad of the grid's corners, with a colour at each corner. */
const GRID_QUAD = {
  points: [
    [-16, -12],
    [16, -12],
    [16, 12],
    [-16, 12],
  ],
  colors: [RED, GREEN, BLUE, YELLOW],
  uvs: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
};

const PRIMITIVE_SCENES = [
  primitiveScene(
    'canvas-primitive-points',
    [RED, GREEN, BLUE, YELLOW].map((color, index) => ({
      points: [centre([-12 + index * 8, -4])],
      colors: [color],
      uvs: [],
    }))
  ),
  // ANGLE leaves out the first pixel of an upward line where Vulkan leaves out its last, as in 3D.
  primitiveScene(
    'canvas-primitive-lines',
    [
      { points: [centre([-20, -8]), centre([20, -8])], colors: [RED, BLUE], uvs: [] },
      { points: [centre([-20, 6]), centre([-20, -14])], colors: [GREEN], uvs: [] },
    ],
    { knownPixels: 2 }
  ),
  primitiveScene('canvas-primitive-triangle', [
    { points: GRID_QUAD.points.slice(0, 3), colors: GRID_QUAD.colors.slice(0, 3), uvs: [] },
  ]),
  primitiveScene('canvas-primitive-quad', [{ ...GRID_QUAD, uvs: [] }]),
  primitiveScene('canvas-primitive-quad-textured', [GRID_QUAD], { isTextured: true }),
  primitiveScene('canvas-primitive-modulate', [{ ...GRID_QUAD, uvs: [] }], {
    item: { ...CENTRE, rotation: 20, modulate: [1.5, 1, 0.5, 0.75] },
  }),
  primitiveScene('canvas-primitive-linear-canvas', [GRID_QUAD], { isTextured: true, linear: true }),
];

/** Halfway to grey: `srgb_to_linear` leaves 0 and 1 as they are, so a linear canvas needs mid tones. */
const midTone = ([r, g, b, a]) => [0.25 + r / 2, 0.25 + g / 2, 0.25 + b / 2, a];

/** A concave outline with a colour at each point, as a Polygon2D with `vertex_colors` draws it. */
const ARROW = {
  points: [
    [-20, -4],
    [0, -4],
    [0, -14],
    [20, 0],
    [0, 14],
    [0, 4],
    [-20, 4],
  ],
  colors: [RED, RED, GREEN, BLUE, GREEN, YELLOW, YELLOW],
};

/** One Polygon2D: its outline, its vertex colours or its one `color`, and its UVs in texels. */
const polygonScene = (name, polygon, fields = {}) =>
  canvasScene('polygon', name, {
    polygon: { color: WHITE, colors: [], uvs: [], isTextured: false, ...polygon },
    ...fields,
  });

/** The arrow's points as texels of the grid, which is 8 by 4. */
const ARROW_UVS = ARROW.points.map(([x, y]) => [(x + 20) / 5, (y + 14) / 7]);

const POLYGON_SCENES = [
  polygonScene('canvas-polygon-vertex-colors', ARROW),
  polygonScene('canvas-polygon-color', { points: ARROW.points, color: [0.2, 0.6, 1, 0.8] }),
  polygonScene('canvas-polygon-textured', { points: ARROW.points, uvs: ARROW_UVS, isTextured: true }),
  polygonScene(
    'canvas-polygon-textured-linear-filter',
    { points: ARROW.points, uvs: ARROW_UVS, isTextured: true },
    {
      filter: 'linear',
    }
  ),
  polygonScene('canvas-polygon-modulate', ARROW, {
    item: {
      ...CENTRE,
      rotation: -35,
      scale: [1.2, 0.8],
      modulate: [1, 0.5, 2, 1],
      selfModulate: [1, 1, 1, 0.6],
    },
  }),
  polygonScene(
    'canvas-polygon-linear-canvas',
    { ...ARROW, colors: ARROW.colors.map(midTone) },
    { linear: true }
  ),
  // `draw_polygon` with one colour, which the vertex buffer repeats on every point.
  canvasScene('drawPolygon', 'canvas-draw-polygon-one-color', {
    polygon: { points: ARROW.points, colors: [[1, 0.5, 0.2, 0.9]], uvs: [], isTextured: false },
  }),
  canvasScene('drawPolygon', 'canvas-draw-polygon-textured', {
    polygon: {
      points: ARROW.points,
      colors: [],
      uvs: ARROW_UVS.map(([x, y]) => [x / 8, y / 4]),
      isTextured: true,
    },
  }),
];

/** A strip of four triangles across the grid, with a colour and a UV at each vertex. */
const STRIP = {
  vertices: [
    [-24, -10],
    [-24, 10],
    [-8, -10],
    [-8, 10],
    [8, -10],
    [8, 10],
    [24, -10],
    [24, 10],
  ],
  colors: [RED, GREEN, BLUE, YELLOW, RED, GREEN, BLUE, YELLOW],
  uvs: [
    [0, 0],
    [0, 1],
    [1 / 3, 0],
    [1 / 3, 1],
    [2 / 3, 0],
    [2 / 3, 1],
    [1, 0],
    [1, 1],
  ],
};

/** One surface of an ArrayMesh with 2D vertices on a MeshInstance2D. */
const meshScene = (name, surface, fields = {}) =>
  canvasScene('mesh', name, {
    surface: { primitive: 'triangles', colors: [], uvs: [], indices: null, customs: [], ...surface },
    isTextured: false,
    ...fields,
  });

/** The strip as triangles of an index array. */
const STRIP_TRIANGLES = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7];

const MESH_SCENES = [
  meshScene('canvas-mesh-triangles', { ...STRIP, indices: STRIP_TRIANGLES }),
  meshScene('canvas-mesh-textured', { ...STRIP, indices: STRIP_TRIANGLES }, { isTextured: true }),
  meshScene(
    'canvas-mesh-no-colors',
    { vertices: STRIP.vertices, uvs: STRIP.uvs, indices: STRIP_TRIANGLES },
    {
      isTextured: true,
    }
  ),
  meshScene('canvas-mesh-strip', { ...STRIP, primitive: 'triangle_strip' }),
  meshScene('canvas-mesh-lines', {
    primitive: 'lines',
    vertices: [centre([-20, -10]), centre([20, -10]), centre([-20, 10]), centre([20, 10])],
    colors: [RED, BLUE, GREEN, YELLOW],
  }),
  meshScene('canvas-mesh-points', {
    primitive: 'points',
    vertices: STRIP.vertices.map(centre),
    colors: STRIP.colors,
  }),
  meshScene(
    'canvas-mesh-modulate',
    { ...STRIP, indices: STRIP_TRIANGLES },
    {
      item: { ...CENTRE, rotation: 15, scale: [0.9, 1.3], modulate: [0.5, 1, 1, 0.7] },
    }
  ),
  meshScene(
    'canvas-mesh-linear-canvas',
    { ...STRIP, colors: STRIP.colors.map(midTone), indices: STRIP_TRIANGLES },
    { isTextured: true, linear: true }
  ),
];

/** A 16 by 8 texture with a border of 3 texels left and right and 2 top and bottom, and a lit centre. */
function patchTexture() {
  const width = 16;
  const height = 8;
  const isBorder = (x, y) => x < 3 || x >= width - 3 || y < 2 || y >= height - 2;
  const texels = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      texels.push(
        isBorder(x, y) ? [40 + x * 12, 200 - y * 20, 60, 255] : [230, 200 + x * 2, 40 + y * 20, 200]
      );
  return { width, height, texels };
}

const PATCH = patchTexture();

/** One `canvas_item_add_nine_patch` on the item, over the whole patch texture. */
const ninePatchScene = (name, patch, fields = {}) =>
  canvasScene('ninepatch', name, {
    texture: PATCH,
    patch: {
      rect: [-26, -18, 52, 36],
      source: [0, 0, 16, 8],
      margins: [3, 2, 3, 2],
      axisX: 'stretch',
      axisY: 'stretch',
      drawsCenter: true,
      modulate: WHITE,
      isTextured: true,
      ...patch,
    },
    ...fields,
  });

const NINE_PATCH_SCENES = [
  ninePatchScene('canvas-ninepatch-stretch', {}),
  ninePatchScene('canvas-ninepatch-tile', { axisX: 'tile', axisY: 'tile' }),
  ninePatchScene('canvas-ninepatch-tile-fit', { axisX: 'tile_fit', axisY: 'tile_fit' }),
  ninePatchScene('canvas-ninepatch-no-centre', { drawsCenter: false, modulate: [1, 0.5, 1, 0.8] }),
  // Row 15 maps to texel row 3.0 of the texture exactly, a nearest-filter tie each GPU breaks its own way.
  ninePatchScene(
    'canvas-ninepatch-region',
    { source: [2, 1, 12, 6], margins: [2, 1, 2, 1] },
    { knownPixels: 52 }
  ),
  ninePatchScene('canvas-ninepatch-linear', { axisX: 'tile_fit' }, { filter: 'linear' }),
  // A zero source reads the whole texture, with the texel size as the patch's pixel size.
  ninePatchScene('canvas-ninepatch-whole-texture', {
    source: [0, 0, 0, 0],
    axisX: 'tile',
    axisY: 'tile_fit',
  }),
  ninePatchScene('canvas-ninepatch-no-texture', { isTextured: false, modulate: [0.4, 0.8, 1, 1] }),
];

/** Rects on a render target that keeps colours linear, `use_hdr_2d`. */
const LINEAR_RECT_SCENES = [
  rectScene('canvas-rect-linear-canvas', { texture: FADING_GRID, linear: true }),
  rectScene('canvas-rect-linear-canvas-modulate', {
    linear: true,
    filter: 'linear',
    canvasModulate: [0.5, 1, 0.75, 1],
    item: { ...CENTRE, modulate: [1, 0.6, 0.6, 0.8] },
  }),
];

/** A rect of the grid drawn with `source`, a user's shader, which proves `rows`. */
const shadedRectScene = (name, source, rows, fields = {}) => rectScene(name, { source, rows, ...fields });

/** The text of a canvas_item shader with `head` above its `vertex()` and `fragment()` lines. */
const shaderText = ({ head = '', vertex, fragment }) =>
  [
    'shader_type canvas_item;',
    head,
    vertex && `void vertex() {\n\t${vertex}\n}`,
    fragment && `void fragment() {\n\t${fragment}\n}`,
  ]
    .filter(Boolean)
    .join('\n\n') + '\n';

const row = (stage) => (name) => `canvas_item.${stage}.${name}`;
const fragmentRows = (...names) => names.map(row('fragment'));
const vertexRows = (...names) => names.map(row('vertex'));

/** Each blend word over the clear colour, with the alpha falling across the grid. */
const BLEND_SCENES = ['mix', 'add', 'sub', 'mul', 'premul_alpha', 'disabled'].map((blend) =>
  shadedRectScene(
    `canvas-shader-blend-${blend.replace('_', '-')}`,
    shaderText({ head: `render_mode blend_${blend};`, fragment: 'COLOR.rgb *= 0.75;' }),
    [`canvas_item render_mode blend_${blend}`],
    { texture: FADING_GRID }
  )
);

const TINTED = shaderText({
  head: 'uniform vec4 tint : source_color = vec4(0.5, 0.25, 0.75, 1.0);',
  fragment: 'COLOR = tint;',
});

const SHADER_SCENES = [
  shadedRectScene(
    'canvas-shader-fragment-uv',
    shaderText({ fragment: 'COLOR = vec4(UV, 0.5, 1.0);' }),
    fragmentRows('COLOR', 'UV')
  ),
  shadedRectScene(
    'canvas-shader-fragment-texture',
    shaderText({
      fragment: 'COLOR = vec4(texture(TEXTURE, UV + vec2(TEXTURE_PIXEL_SIZE.x, 0.0)).bgr, 1.0);',
    }),
    fragmentRows('TEXTURE', 'TEXTURE_PIXEL_SIZE')
  ),
  shadedRectScene(
    'canvas-shader-fragment-vertex',
    shaderText({ fragment: 'COLOR = vec4(fract(VERTEX / 8.0), 0.0, 1.0);' }),
    fragmentRows('VERTEX'),
    { item: { ...CENTRE, rotation: 30 } }
  ),
  shadedRectScene(
    'canvas-shader-fragcoord',
    shaderText({ fragment: 'COLOR = vec4(FRAGCOORD.xy / vec2(64.0, 48.0), FRAGCOORD.z, 1.0);' }),
    fragmentRows('FRAGCOORD')
  ),
  shadedRectScene(
    'canvas-shader-screen-uv',
    shaderText({ fragment: 'COLOR = vec4(SCREEN_UV, SCREEN_PIXEL_SIZE.x * 32.0, 1.0);' }),
    fragmentRows('SCREEN_UV', 'SCREEN_PIXEL_SIZE'),
    { canvasTransform: [1.5, 0, 0, 0.75, -10, 6] }
  ),
  shadedRectScene(
    'canvas-shader-region-rect',
    shaderText({ fragment: 'COLOR = vec4(REGION_RECT.xy * 2.0, REGION_RECT.zw);' }),
    fragmentRows('REGION_RECT'),
    { rects: [rect({ rect: [-12, -12, 24, 24], source: [2, 1, 3, 3] })] }
  ),
  shadedRectScene(
    'canvas-shader-normal-map',
    shaderText({
      fragment:
        'NORMAL_MAP = vec3(UV, 1.0);\n\tNORMAL_MAP_DEPTH = 0.5;\n\tCOLOR = vec4(NORMAL * 0.5 + 0.5, 1.0);',
    }),
    fragmentRows('NORMAL', 'NORMAL_MAP', 'NORMAL_MAP_DEPTH')
  ),
  shadedRectScene(
    'canvas-shader-normal-specular-textures',
    shaderText({
      fragment:
        'COLOR = vec4(texture(NORMAL_TEXTURE, UV).rg, texture(SPECULAR_SHININESS_TEXTURE, UV).b * SPECULAR_SHININESS.a, 1.0);',
    }),
    fragmentRows('NORMAL_TEXTURE', 'SPECULAR_SHININESS_TEXTURE', 'SPECULAR_SHININESS')
  ),
  shadedRectScene(
    'canvas-shader-canvas-texture-maps',
    shaderText({
      fragment:
        'COLOR = vec4(texture(NORMAL_TEXTURE, UV).rg, texture(SPECULAR_SHININESS_TEXTURE, UV).b * SPECULAR_SHININESS.a, 1.0);',
    }),
    fragmentRows('NORMAL_TEXTURE', 'SPECULAR_SHININESS_TEXTURE', 'SPECULAR_SHININESS'),
    { maps: GRID_MAPS }
  ),
  shadedRectScene(
    'canvas-shader-light-vertex',
    shaderText({
      fragment:
        'LIGHT_VERTEX.z = 0.5;\n\tSHADOW_VERTEX += vec2(1.0);\n\tCOLOR = vec4(fract(LIGHT_VERTEX.xy / 8.0), LIGHT_VERTEX.z + fract(SHADOW_VERTEX.x / 16.0) * 0.25, 1.0);',
    }),
    fragmentRows('LIGHT_VERTEX', 'SHADOW_VERTEX')
  ),
  shadedRectScene(
    'canvas-shader-at-light-pass',
    shaderText({
      head: 'varying float vertex_pass;',
      vertex: 'vertex_pass = AT_LIGHT_PASS ? 1.0 : 0.25;',
      fragment: 'COLOR = vec4(AT_LIGHT_PASS ? 1.0 : 0.5, vertex_pass, 0.0, 1.0);',
    }),
    [...fragmentRows('AT_LIGHT_PASS'), ...vertexRows('AT_LIGHT_PASS')]
  ),
  shadedRectScene(
    'canvas-shader-vertex-moved',
    shaderText({ vertex: 'VERTEX += vec2(4.0, -2.0);\n\tUV = UV.yx;\n\tCOLOR = vec4(1.0, 0.5, 0.25, 1.0);' }),
    vertexRows('VERTEX', 'UV', 'COLOR'),
    { item: { ...CENTRE, rotation: 30 } }
  ),
  shadedRectScene(
    'canvas-shader-vertex-matrices',
    shaderText({
      vertex:
        'COLOR = vec4(MODEL_MATRIX[0].y + 0.5, CANVAS_MATRIX[3].x / -20.0, SCREEN_MATRIX[0].x * 16.0, 1.0);',
    }),
    vertexRows('MODEL_MATRIX', 'CANVAS_MATRIX', 'SCREEN_MATRIX'),
    { item: { ...CENTRE, rotation: 20 }, canvasTransform: [1.5, 0, 0, 0.75, -10, 6] }
  ),
  shadedRectScene(
    'canvas-shader-vertex-ids',
    shaderText({
      vertex:
        'COLOR = vec4(float(VERTEX_ID) / 4.0, float(INSTANCE_ID) / 3.0 + 0.25, INSTANCE_CUSTOM.x + CUSTOM0.x + CUSTOM1.x + 0.5, TEXTURE_PIXEL_SIZE.x * 8.0);',
    }),
    vertexRows('VERTEX_ID', 'INSTANCE_ID', 'INSTANCE_CUSTOM', 'CUSTOM0', 'CUSTOM1', 'TEXTURE_PIXEL_SIZE'),
    {
      rects: [
        rect({ rect: [-30, -20, 16, 8], source: [0, 0, 4, 2] }),
        rect({ rect: [-10, -6, 24, 12] }),
        rect({ rect: [14, 4, -16, 16], source: [4, 2, 4, 2] }),
      ],
    }
  ),
  shadedRectScene(
    'canvas-shader-constants',
    shaderText({ fragment: 'COLOR = vec4(PI / 4.0, TAU / 8.0, E / 4.0, 1.0);' }),
    ['PI', 'TAU', 'E'].map(row('constants'))
  ),
  shadedRectScene(
    'canvas-shader-time',
    shaderText({ fragment: 'COLOR = vec4(fract(TIME), fract(TIME * 0.5), 0.5, 1.0);' }),
    ['canvas_item.global.TIME'],
    { clock: { fixedFps: 3, rolloverSeconds: 3600, frames: FRAMES_BEFORE_READ } }
  ),
  shadedRectScene(
    'canvas-shader-skip-vertex-transform',
    shaderText({
      head: 'render_mode skip_vertex_transform;',
      vertex: 'VERTEX = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy + vec2(6.0, 0.0);',
    }),
    ['canvas_item render_mode skip_vertex_transform'],
    { item: { ...CENTRE, rotation: 30 } }
  ),
  shadedRectScene(
    'canvas-shader-world-vertex-coords',
    shaderText({ head: 'render_mode world_vertex_coords;', vertex: 'VERTEX.x += 6.0;' }),
    ['canvas_item render_mode world_vertex_coords'],
    { item: { ...CENTRE, rotation: 30 } }
  ),
  shadedRectScene(
    'canvas-shader-unshaded',
    shaderText({ head: 'render_mode unshaded;' }),
    ['canvas_item render_mode unshaded'],
    { canvasModulate: [0.5, 1, 0.75, 1] }
  ),
  shadedRectScene('canvas-shader-light-only', shaderText({ head: 'render_mode light_only;' }), [
    'canvas_item render_mode light_only',
  ]),
  meshScene(
    'canvas-shader-mesh-customs',
    {
      ...STRIP,
      indices: STRIP_TRIANGLES,
      customs: [
        STRIP.vertices.flatMap((_, vertex) => [vertex / 8, 1 - vertex / 8, 0.25, 0.5]),
        STRIP.vertices.flatMap((_, vertex) => [0.1, 0.2, (vertex % 2) * 0.5 + 0.25, 0.75]),
      ],
    },
    {
      source: shaderText({ vertex: 'COLOR = vec4(CUSTOM0.xy, CUSTOM1.z, CUSTOM0.w + CUSTOM1.w * 0.5);' }),
      rows: vertexRows('CUSTOM0', 'CUSTOM1'),
    }
  ),
  meshScene(
    'canvas-shader-point-size-mesh',
    { primitive: 'points', vertices: STRIP.vertices.map(centre), colors: STRIP.colors },
    {
      source: shaderText({
        vertex: 'POINT_SIZE = 2.0 + float(VERTEX_ID) * 1.5;',
        fragment: 'COLOR = vec4(POINT_COORD, COLOR.b, 1.0);',
      }),
      rows: [...vertexRows('POINT_SIZE'), ...fragmentRows('POINT_COORD')],
      // An even point's edge lies on pixel centres, and lavapipe takes the top row, llvmpipe the bottom.
      knownPixels: 20,
    }
  ),
  primitiveScene(
    'canvas-shader-point-size-primitive',
    [RED, GREEN, BLUE, YELLOW].map((color, index) => ({
      points: [centre([-18 + index * 12, -4 + index * 3])],
      colors: [color],
      uvs: [],
    })),
    {
      source: shaderText({
        vertex: 'POINT_SIZE = 3.0 + float(INSTANCE_ID) * 2.0;',
        fragment: 'COLOR = vec4(POINT_COORD.x, COLOR.g, POINT_COORD.y, 1.0);',
      }),
      rows: [...vertexRows('POINT_SIZE'), ...fragmentRows('POINT_COORD')],
    }
  ),
  ...BLEND_SCENES,
  // A source colour that a linear target turns linear (`renderer_canvas_render_rd.cpp:1703-1704`).
  rectScene('canvas-shader-source-color', { source: TINTED }),
  rectScene('canvas-shader-source-color-linear', { source: TINTED, linear: true }),
];

export const CANVAS_SCENES = [
  ...RECT_SCENES,
  ...PRIMITIVE_SCENES,
  ...POLYGON_SCENES,
  ...MESH_SCENES,
  ...NINE_PATCH_SCENES,
  ...LINEAR_RECT_SCENES,
  ...SHADER_SCENES,
];
