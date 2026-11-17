import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { BLACK } from '../offscreen/draw.js';

interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a `target` of pixels lands in a `view`: the largest whole fit at one scale, centred. */
function fitRect(view: THREE.Vector2, target: { x: number; y: number }): FitRect {
  const scale = Math.min(view.x / target.x, view.y / target.y);
  const width = target.x * scale;
  const height = target.y * scale;
  return { x: (view.x - width) / 2, y: (view.y - height) / 2, width, height };
}

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
    blending: THREE.NoBlending,
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

/** Fits `source` into the buffer at one scale, with black or transparent bars. Null leaves the bars. */
export function presentRootTarget(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture | null,
  targetSize: { x: number; y: number },
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
  const rect = fitRect(view, targetSize);
  const { quad, opaque, transparent } = presenterFor(gl);
  const material = isTransparent ? transparent : opaque;
  material.map = source;
  quad.material = material;
  // The target holds the bytes Godot shows, so the draw encodes nothing.
  const outputColorSpace = gl.outputColorSpace;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  gl.setViewport(rect.x, rect.y, rect.width, rect.height);
  try {
    gl.render(quad, identityCamera);
  } finally {
    gl.setViewport(0, 0, view.x, view.y);
    gl.outputColorSpace = outputColorSpace;
    material.map = null;
  }
}
