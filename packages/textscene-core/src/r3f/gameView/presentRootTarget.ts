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

/** Written and read only inside `presentRootTarget`, so a frame allocates no vector. */
const viewScratch = new THREE.Vector2();
const clearColorScratch = new THREE.Color();

/** Draws `source` where the window puts it, with black or transparent bars. Null leaves the bars. */
export function presentRootTarget(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture | null,
  window: Pick<RootWindow, 'size' | 'drawRect'>,
  isTransparent: boolean
): void {
  const view = gl.getSize(viewScratch);
  gl.setRenderTarget(null);
  const previousAlpha = gl.getClearAlpha();
  const previousColor = gl.getClearColor(clearColorScratch);
  gl.setClearColor(BLACK, isTransparent ? 0 : 1);
  gl.clear(true, false, false);
  gl.setClearColor(previousColor, previousAlpha);
  if (!source) return;
  const rect = targetRectInPane(view, window);
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
  gl.setViewport(rect.x, rect.y, rect.w, rect.h);
  try {
    gl.render(quad, identityCamera);
  } finally {
    gl.setViewport(0, 0, view.x, view.y);
    gl.autoClear = autoClear;
    gl.outputColorSpace = outputColorSpace;
    material.map = null;
  }
}
