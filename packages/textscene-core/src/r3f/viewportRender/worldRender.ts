import type { ViewportDescription } from './viewportDescription.js';
import type { ViewportShadowAtlas } from '../positionalShadow/viewportShadowAtlas.js';
import type { ProbeCapture } from '../reflectionProbe/captureCameras.js';
import { drawAtMipmapBias } from '../materials/godotMipmapBias.js';

export interface WorldRender {
  viewport: ViewportDescription;
  /** Null for the root's atlas, which each scene's shadow fit builds. A Control raster pass lights no 3D. */
  shadowAtlas: ViewportShadowAtlas | null;
  /** Whether the render draws a canvas through a Godot canvas transform: a SubViewport's 2D pass. */
  hasCanvasTransform: boolean;
  /** Set for a reflection probe capture. */
  probeCapture?: ProbeCapture;
}

/** Pushed only by `drawWorld` around one draw, and popped when that draw returns. */
const rendersUnderWay: WorldRender[] = [];

/** Runs `draw` with `render` as the render under way. Renders nest, and the outer one returns after. */
export function drawWorld(render: WorldRender, draw: () => void): void {
  rendersUnderWay.push(render);
  try {
    drawAtMipmapBias(render.viewport.mipmapBias, draw);
  } finally {
    rendersUnderWay.pop();
  }
}

/** The render under way, or null outside any `drawWorld`. */
export function renderUnderWay(): WorldRender | null {
  return rendersUnderWay.at(-1) ?? null;
}
