import * as THREE from 'three';
import {
  CANVAS_VARIANTS,
  CanvasTextureBinding,
  DEFAULT_CANVAS_SHADER,
  rectBatchGeometry,
  rectInstanceData,
  specialiseCanvasDraw,
  textureRectRegion,
  transpileCanvasItem,
  writeCanvasBindings,
} from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
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
const CLEAR_COLOR = new THREE.Color(0.3, 0.3, 0.3);

const rgba = ([r, g, b, a]) => ({ r, g, b, a });
const rect2 = ([x, y, w, h]) => ({ x, y, w, h });

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

function gridTexture({ width, height, texels }) {
  const texture = new THREE.DataTexture(Uint8Array.from(texels.flat()), width, height);
  texture.needsUpdate = true;
  return texture;
}

/** The geometry of the scene's rects on its item, with the texture's texel size. */
function rectsGeometry({ rects, item, texture }) {
  const finalModulate = rgba(item.modulate.map((channel, index) => channel * item.selfModulate[index]));
  const itemDraw = { transform: itemTransform(item), finalModulate };
  const texelSize = { x: 1 / texture.width, y: 1 / texture.height };
  const records = rects.map(({ rect, source, modulate, transpose, clipUv }) =>
    rectInstanceData(
      textureRectRegion(rect2(rect), rect2(source), rgba(modulate), { transpose, clipUv }),
      itemDraw,
      texelSize
    )
  );
  return rectBatchGeometry(records);
}

/** The pixels of the scene's rects drawn with Godot's default canvas shader, or `{ faults }`. */
function drawCanvas(spec) {
  const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
  const [a, b, c, d, tx, ty] = spec.canvasTransform;
  writeCanvasBindings(draw, {
    width: spec.width,
    height: spec.height,
    canvasTransform: { a, b, c, d, tx, ty },
    canvasModulate: rgba(spec.canvasModulate),
    time: 0,
    snapVerticesToPixel: spec.snapVertices,
  });
  const texture = gridTexture(spec.texture);
  const binding = new CanvasTextureBinding(draw);
  binding.bind(texture, { filter: spec.filter, repeat: spec.repeat });
  const faults = [];
  draw.material.onTranslatorFault = (fault) => faults.push(fault);
  const mesh = new THREE.Mesh(rectsGeometry(spec), draw.material);
  mesh.frustumCulled = false;
  displayRenderer.setClearColor(CLEAR_COLOR, 1);
  const pixels = framePixels(displayRenderer, new THREE.Scene().add(mesh), new THREE.Camera(), spec);
  mesh.geometry.dispose();
  binding.dispose();
  texture.dispose();
  draw.material.dispose();
  if (faults.length > 0) return { faults: faults.map(({ name, message, log }) => ({ name, message, log })) };
  return { pixels: [...pixels] };
}

globalThis.linkCanvasVariants = linkCanvasVariants;
globalThis.drawCanvas = drawCanvas;
