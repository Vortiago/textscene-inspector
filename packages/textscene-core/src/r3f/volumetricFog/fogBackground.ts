/**
 * The colour background under volumetric fog. three clears to a colour background and draws
 * nothing a shader could fog, so Godot's fog-only sky pass draws it here: the clear colour, fogged
 * as the sky is (`forward_clustered/render_forward_clustered.cpp:1996-2014`).
 */

import * as THREE from 'three';
import { FULL_SCREEN_VERTEX } from '../lighting2d/fullScreenQuad.js';
import {
  VOLUMETRIC_FOG_PARS_CHUNK,
  VOLUMETRIC_FOG_SKY_CHUNK,
  volumetricFogUniformRecord,
} from './fogComposite.js';

/** Below every `render_priority` (`material.h:66-67`), so three's opaque sort draws it first. */
const BACKGROUND_RENDER_ORDER = Number.MIN_SAFE_INTEGER;

const FOG_BACKGROUND_FRAGMENT = /* glsl */ `
uniform vec3 clearColor;

#include <${VOLUMETRIC_FOG_PARS_CHUNK}>

void main() {
	gl_FragColor = vec4( clearColor, 1.0 );
	#include <${VOLUMETRIC_FOG_SKY_CHUNK}>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/**
 * A screen-filling quad of the linear `clearColor`, under every surface. It writes no depth, casts
 * nothing, takes no pick and stays out of the camera's framing.
 */
export function createFogBackground(clearColor: THREE.Color): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    name: 'VolumetricFogBackground',
    uniforms: { clearColor: { value: clearColor.clone() }, ...volumetricFogUniformRecord() },
    vertexShader: FULL_SCREEN_VERTEX,
    fragmentShader: FOG_BACKGROUND_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const background = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  background.name = 'VolumetricFogBackground';
  background.renderOrder = BACKGROUND_RENDER_ORDER;
  background.frustumCulled = false;
  background.layers.enableAll();
  background.userData = { tscnFrameExcluded: true };
  background.raycast = () => {};
  return background;
}

export function disposeFogBackground(background: THREE.Mesh): void {
  background.geometry.dispose();
  (background.material as THREE.Material).dispose();
}
