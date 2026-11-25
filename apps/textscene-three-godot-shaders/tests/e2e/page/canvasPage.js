import * as THREE from 'three';
import {
  attributesGeometry,
  attributesObject,
  attributesVariant,
  CANVAS_VARIANTS,
  CanvasTextureBinding,
  DEFAULT_CANVAS_SHADER,
  meshConstants,
  ninePatchInstanceData,
  polygonCommand,
  polygonConstants,
  primitiveBatchGeometry,
  primitiveCommand,
  primitiveDraw,
  primitiveInstanceData,
  primitiveObject,
  quadBatchGeometry,
  rectInstanceData,
  specialiseCanvasDraw,
  textureRectRegion,
  transpileCanvasItem,
  triangleArrayCommand,
  writeCanvasBindings,
} from '@textscene/three-godot-shaders';
import { framePixels, linearFramePixels } from './framePixels.js';
import { displayRenderer } from './godotView.js';

/** The faults of drawing `draw` once, which a program the GPU refuses to compile or link reports. */
function drawFaults(draw) {
  const faults = [];
  draw.material.onTranslatorFault = (fault) => faults.push(fault);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const mesh = new THREE.Mesh(geometry, draw.material);
  mesh.frustumCulled = false;
  framePixels(displayRenderer, new THREE.Scene().add(mesh), new THREE.Camera(), { width: 4, height: 4 });
  geometry.dispose();
  return faults.map(({ message, log }) => ({ message, log }));
}

/** Each variant of Godot's default canvas shader, unlit and lit, with the faults its program reports. */
function canvasVariantFaults(item) {
  return CANVAS_VARIANTS.flatMap((variant) => {
    const draw = item.draw(variant);
    const linked = [false, true].map((useLighting) => {
      specialiseCanvasDraw(draw, { useLighting });
      return { variant, useLighting, faults: drawFaults(draw) };
    });
    draw.material.dispose();
    return linked;
  });
}

/** The faults of each variant, or the error that stopped the transpile, as `drawMesh` returns one. */
function linkCanvasVariants() {
  try {
    return { linked: canvasVariantFaults(transpileCanvasItem(DEFAULT_CANVAS_SHADER)) };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
}

/** Godot's default clear colour, which an sRGB 2D render target stores as it is. */
const CLEAR = 0.3;

const rgba = ([r, g, b, a]) => ({ r, g, b, a });
const rect2 = ([x, y, w, h]) => ({ x, y, w, h });
const vector2 = ([x, y]) => ({ x, y });

const f = Math.fround;

/** `Node2D`'s transform with no skew, in float as Godot's `real_t` rounds it (`transform_2d.cpp:107`). */
function itemTransform({ position: [tx, ty], rotation, scale: [sx, sy] }) {
  const angle = f(f(rotation) * f(Math.PI / 180));
  const [cos, sin] = [f(Math.cos(angle)), f(Math.sin(angle))];
  return {
    a: f(cos * f(sx)),
    b: f(sin * f(sx)),
    c: f(-sin * f(sy)),
    d: f(cos * f(sy)),
    tx: f(tx),
    ty: f(ty),
  };
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function dataTexture({ width, height, texels }) {
  const texture = new THREE.DataTexture(Uint8Array.from(texels.flat()), width, height);
  texture.needsUpdate = true;
  return texture;
}

/** The draws of one scene: one per variant, each with the frame's bindings and its texture binding. */
class SceneDraws {
  constructor(spec) {
    this.spec = spec;
    this.item = transpileCanvasItem(spec.source);
    this.texture = dataTexture(spec.texture);
    this.bindings = [];
    this.materials = new Set();
    this.faults = [];
    const [a, b, c, d, tx, ty] = spec.canvasTransform;
    this.frame = {
      width: spec.width,
      height: spec.height,
      canvasTransform: { a, b, c, d, tx, ty },
      canvasModulate: rgba(spec.canvasModulate),
      time: 0,
      snapVerticesToPixel: spec.snapVertices,
      usesLinearColors: spec.linear,
    };
    const { modulate, selfModulate } = spec.item;
    const finalModulate = rgba(modulate.map((channel, index) => channel * selfModulate[index]));
    this.itemDraw = { transform: itemTransform(spec.item), finalModulate, usesLinearColors: spec.linear };
  }

  /** The draw of `variant` with the scene's texture bound, or none, and the texel size it binds. */
  draw(variant, isTextured) {
    const draw = this.item.draw(variant);
    writeCanvasBindings(draw, this.frame);
    const binding = new CanvasTextureBinding(draw);
    const state = { filter: this.spec.filter, repeat: this.spec.repeat, usesLinearColors: this.spec.linear };
    const texelSize = binding.bind(isTextured ? this.texture : undefined, state);
    this.bindings.push(binding);
    this.materials.add(draw.material);
    draw.material.onTranslatorFault = (fault) => this.faults.push(fault);
    return { draw, texelSize };
  }

  dispose() {
    for (const binding of this.bindings) binding.dispose();
    this.texture.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/** The quad batch of the scene's rects. */
function rectObjects(draws, { rects }) {
  const { draw, texelSize } = draws.draw('quad', true);
  const records = rects.map(({ rect, source, modulate, transpose, clipUv }) =>
    rectInstanceData(
      textureRectRegion(rect2(rect), rect2(source), rgba(modulate), { transpose, clipUv }),
      draws.itemDraw,
      texelSize
    )
  );
  return [primitiveObject('triangles', quadBatchGeometry(records), draw.material)];
}

/** One batch for each run of primitives of one point count, as Godot breaks a batch at a new count. */
function primitiveObjects(draws, { primitives, isTextured }) {
  const runs = [];
  for (const { points, colors, uvs } of primitives) {
    const command = primitiveCommand(points.map(vector2), colors.map(rgba), uvs.map(vector2));
    const records = primitiveInstanceData(command, draws.itemDraw);
    const last = runs.at(-1);
    if (last?.count === points.length) last.records.push(...records);
    else runs.push({ count: points.length, records });
  }
  return runs.map(({ count, records }) => {
    const { variant, primitive } = primitiveDraw(count);
    const { draw } = draws.draw(variant, isTextured);
    return primitiveObject(primitive, primitiveBatchGeometry(records, count), draw.material);
  });
}

/** `Polygon2D`'s draw (`polygon_2d.cpp:221-320`): its vertex colours or its colour, UVs over the texture. */
function polygonObjects(draws, { polygon, texture }) {
  const points = polygon.points.map(vector2);
  const colors = polygon.colors.length === points.length ? polygon.colors : points.map(() => polygon.color);
  const uvs = polygon.isTextured
    ? polygon.uvs.map(([x, y]) => ({ x: x / texture.width, y: y / texture.height }))
    : [];
  const command = triangleArrayCommand(triangulateOutline(points), points, colors.map(rgba), uvs);
  return [polygonObject(draws, command, polygon.isTextured)];
}

/** `draw_polygon` (`canvas_item.cpp:970`): the outline cut into triangles, its colours and UVs as given. */
function drawnPolygonObjects(draws, { polygon }) {
  const command = polygonCommand(
    polygon.points.map(vector2),
    polygon.colors.map(rgba),
    polygon.uvs.map(vector2)
  );
  return [polygonObject(draws, command, polygon.isTextured)];
}

/** One polygon command through the attributes variant, with the item's push constants. */
function polygonObject(draws, command, isTextured) {
  const { draw } = draws.draw('attributes', isTextured);
  return attributesObject(draw, attributesGeometry(command), 'triangles', polygonConstants(draws.itemDraw));
}

/** `Geometry2D::triangulate_polygon`, which `polygonCommand` runs. */
const triangulateOutline = (points) => polygonCommand(points, [], []).indices;

/** `MeshInstance2D`'s `draw_mesh` (`mesh_instance_2d.cpp:39`): its surface with no transform or modulate. */
function meshObjects(draws, { surface, isTextured }) {
  const arrays = {
    primitive: surface.primitive,
    indices: surface.indices ?? undefined,
    points: surface.vertices.map(vector2),
    colors: surface.colors.map(rgba),
    uvs: surface.uvs.map(vector2),
  };
  const { draw } = draws.draw(attributesVariant(surface.primitive), isTextured);
  const constants = meshConstants(draws.itemDraw, { transform: IDENTITY, modulate: WHITE });
  return [attributesObject(draw, attributesGeometry(arrays), surface.primitive, constants)];
}

/** The quad batch of the scene's one nine-patch. */
function ninePatchObjects(draws, { patch }) {
  const { draw, texelSize } = draws.draw('ninepatch', patch.isTextured);
  const command = {
    rect: rect2(patch.rect),
    source: rect2(patch.source),
    modulate: rgba(patch.modulate),
    margins: patch.margins,
    axisX: patch.axisX,
    axisY: patch.axisY,
    drawsCenter: patch.drawsCenter,
  };
  const record = ninePatchInstanceData(command, draws.itemDraw, texelSize);
  return [primitiveObject('triangles', quadBatchGeometry([record]), draw.material)];
}

const OBJECTS_OF_KIND = {
  rect: rectObjects,
  primitive: primitiveObjects,
  polygon: polygonObjects,
  drawPolygon: drawnPolygonObjects,
  mesh: meshObjects,
  ninepatch: ninePatchObjects,
};

/** The pixels of the scene's item drawn through its canvas shader, or `{ faults }`. */
function drawCanvas(spec) {
  const draws = new SceneDraws(spec);
  const scene = new THREE.Scene();
  // Godot draws the batches of an item in the order of its commands.
  OBJECTS_OF_KIND[spec.kind](draws, spec).forEach((object, index) => {
    object.renderOrder = index;
    scene.add(object);
  });
  const clear = spec.linear ? srgbToLinear(CLEAR) : CLEAR;
  displayRenderer.setClearColor(new THREE.Color(clear, clear, clear), 1);
  const read = spec.linear ? linearFramePixels : framePixels;
  const pixels = read(displayRenderer, scene, new THREE.Camera(), spec);
  scene.traverse((object) => object.geometry?.dispose());
  draws.dispose();
  const { faults } = draws;
  if (faults.length > 0) return { faults: faults.map(({ name, message, log }) => ({ name, message, log })) };
  return { pixels: [...pixels] };
}

/** `Color::srgb_to_linear` of one channel (`color.h:192`). */
const srgbToLinear = (c) => (c < 0.04045 ? c * (1 / 12.92) : Math.pow((c + 0.055) * (1 / 1.055), 2.4));

globalThis.linkCanvasVariants = linkCanvasVariants;
globalThis.drawCanvas = drawCanvas;
