import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { BLACK } from '../offscreen/draw.js';
import type { RootWindow } from './rootWindow.js';
import { blitShift, targetRectInPane } from './windowFit.js';

interface Presenter {
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  opaque: THREE.MeshBasicMaterial;
  transparent: THREE.MeshBasicMaterial;
}

/** Opaque writes alpha 1, as Godot samples a viewport without `transparent_bg` with `swizzle_a = ONE`. */
function presentMaterial(transparent: boolean): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name: 'GameViewPresent',
    transparent,
    // Normal, not none, when opaque: only then three defines OPAQUE and writes alpha 1, still unblended.
    blending: transparent ? THREE.NoBlending : THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

/** One per renderer: three leaves a dispose listener that closes over the renderer on each it draws. */
const presenterFor = perObject<THREE.WebGLRenderer, Presenter>(() => {
  const opaque = presentMaterial(false);
  // A 2x2 plane under the identity camera covers clip space, with uv 0 to 1 over the target.
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), opaque);
  quad.frustumCulled = false;
  return { quad, opaque, transparent: presentMaterial(true) };
});

const identityCamera = new THREE.Camera();

/** Written and read only by the draws of this module, so a frame allocates no vector. */
const viewScratch = new THREE.Vector2();
const clearColorScratch = new THREE.Color();

/** Draws `source` where the window puts it in the pane, with black bars. */
export function presentRootTarget(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture | null,
  window: Pick<RootWindow, 'size' | 'drawRect'>,
  isTransparent: boolean
): void {
  const pane = gl.getSize(viewScratch);
  gl.setRenderTarget(null);
  const rect = targetRectInPane(pane, window);
  gl.setViewport(rect.x, rect.y, rect.w, rect.h);
  try {
    drawWindow(gl, source, isTransparent);
  } finally {
    gl.setViewport(0, 0, pane.x, pane.y);
  }
}

/** Draws the whole window into `target`, a target of the window's size, as the pane shows it. */
export function drawWindowInto(
  gl: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  source: THREE.Texture | null,
  window: Pick<RootWindow, 'size' | 'drawRect'>,
  isTransparent: boolean
): void {
  // A bound target takes its own viewport, in its pixels, not the renderer's.
  const rect = targetRectInPane(window.size, window);
  target.viewport.set(rect.x, rect.y, rect.w, rect.h);
  gl.setRenderTarget(target);
  drawWindow(gl, source, isTransparent);
}

/** Clears the whole bound surface to the bars, since a clear ignores the viewport, then draws `source`. */
function drawWindow(gl: THREE.WebGLRenderer, source: THREE.Texture | null, isTransparent: boolean): void {
  const previousAlpha = gl.getClearAlpha();
  const previousColor = gl.getClearColor(clearColorScratch);
  // Opaque under a transparent background too (rasterizer_gles3.cpp:422): only the target holds alpha.
  gl.setClearColor(BLACK, 1);
  gl.clear(true, false, false);
  gl.setClearColor(previousColor, previousAlpha);
  if (!source) return;
  const { quad, opaque, transparent } = presenterFor(gl);
  const material = isTransparent ? transparent : opaque;
  material.map = source;
  quad.material = material;
  const shift = blitShift(source);
  quad.position.set(shift.x, shift.y, 0);
  quad.updateMatrixWorld();
  // The target holds the bytes Godot shows, so the draw encodes nothing.
  const outputColorSpace = gl.outputColorSpace;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  // An auto-clear ignores the viewport, and would clear the bars to the canvas's clear colour.
  const autoClear = gl.autoClear;
  gl.autoClear = false;
  try {
    gl.render(quad, identityCamera);
  } finally {
    gl.autoClear = autoClear;
    gl.outputColorSpace = outputColorSpace;
    material.map = null;
  }
}
