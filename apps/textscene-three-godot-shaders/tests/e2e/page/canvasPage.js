import * as THREE from 'three';
import {
  CANVAS_VARIANTS,
  DEFAULT_CANVAS_SHADER,
  specialiseCanvasDraw,
  transpileCanvasItem,
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

globalThis.linkCanvasVariants = linkCanvasVariants;
