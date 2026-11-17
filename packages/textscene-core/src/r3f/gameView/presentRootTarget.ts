/**
 * Shows the root viewport's target on the drawing buffer, fitted into it at one uniform scale. Bars
 * fill the rest: black, or transparent for a transparent root.
 */

import * as THREE from 'three';
import { fullScreenPass } from '../fullScreenPass.js';
import { drawFullScreen } from '../fullScreenPass.js';
import { perObject } from '../../utils/perObject.js';

export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a `target` of pixels lands in a `view`: the largest whole fit at one scale, centred. */
export function fitRect(view: { width: number; height: number }, target: { x: number; y: number }): FitRect {
  const scale = Math.min(view.width / target.x, view.height / target.y);
  const width = target.x * scale;
  const height = target.y * scale;
  return { x: (view.width - width) / 2, y: (view.height - height) / 2, width, height };
}

const PRESENT_FRAGMENT = /* glsl */ `
uniform sampler2D source;
uniform bool opaque;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(source, vUv);
  gl_FragColor = opaque ? vec4(texel.rgb, 1.0) : texel;
}`;

const presentPassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  fullScreenPass('GameViewPresent', PRESENT_FRAGMENT, { source: { value: null }, opaque: { value: true } })
);

const BAR_COLOR = new THREE.Color(0, 0, 0);

/**
 * Draws the bytes of `source`, the plain view of the root's target, into the fitted rect of the
 * drawing buffer. A null `source` leaves only the bars.
 */
export function presentRootTarget(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture | null,
  targetSize: { x: number; y: number },
  isTransparent: boolean
): void {
  const view = gl.getSize(new THREE.Vector2());
  gl.setRenderTarget(null);
  const previousAlpha = gl.getClearAlpha();
  const previousColor = gl.getClearColor(new THREE.Color());
  gl.setClearColor(BAR_COLOR, isTransparent ? 0 : 1);
  gl.clear(true, true, true);
  gl.setClearColor(previousColor, previousAlpha);
  if (!source) return;
  const rect = fitRect({ width: view.x, height: view.y }, targetSize);
  const pass = presentPassFor(gl);
  pass.uniforms.source!.value = source;
  pass.uniforms.opaque!.value = !isTransparent;
  gl.setViewport(rect.x, rect.y, rect.width, rect.height);
  try {
    drawFullScreen(gl, pass, null);
  } finally {
    gl.setViewport(0, 0, view.x, view.y);
    pass.uniforms.source!.value = null;
  }
}
