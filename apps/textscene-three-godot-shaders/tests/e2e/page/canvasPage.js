import * as THREE from 'three';
import { CANVAS_VARIANTS, specialiseCanvasDraw, transpileCanvasItem } from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer } from './godotView.js';

/** Godot's default canvas shader, a version with empty slots (`renderer_canvas_render_rd.cpp:1762`). */
const DEFAULT_CANVAS_SHADER = 'shader_type canvas_item;\n';

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
function linkCanvasVariants() {
  const item = transpileCanvasItem(DEFAULT_CANVAS_SHADER);
  return CANVAS_VARIANTS.flatMap((variant) =>
    [false, true].map((useLighting) => {
      const draw = item.draw(variant);
      specialiseCanvasDraw(draw, { useLighting });
      return { variant, useLighting, faults: drawFaults(draw) };
    })
  );
}

globalThis.linkCanvasVariants = linkCanvasVariants;
