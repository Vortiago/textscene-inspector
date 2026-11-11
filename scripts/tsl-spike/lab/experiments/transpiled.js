/**
 * The transpiler's light functions beside the spike's hand-written ones: one sphere under one
 * light, drawn with each on `WebGLRenderer` through the handler, and the two pictures compared.
 */

import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { float, normalView, positionViewDirection, uniform, vec3, vec4 } from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import {
  burleyDiffuseNL,
  ggxSpecular,
} from '../../../../packages/textscene-core/src/r3f/tslSpike/godotLightFunctions.ts';
import { godotDiffuseNL, godotSpecularBRDF } from '../generated/lightFunctions.js';
import { copyPixels, imageDelta } from '../pixels.js';

const F0 = vec3(0.04);
const METALNESS = float(0);
const NO_SIZE = float(0);

function litBy(diffuseNL, specular) {
  const material = new NodeMaterial();
  material.fragmentNode = vec4(vec3(diffuseNL.mul(0.5)).add(specular), 1);
  return material;
}

function handWritten(lightDirection, roughness) {
  const dotLH = positionViewDirection.dot(lightDirection.add(positionViewDirection).normalize()).clamp();
  return litBy(
    burleyDiffuseNL(normalView.dot(lightDirection), normalView.dot(positionViewDirection), dotLH, roughness),
    ggxSpecular(
      lightDirection,
      positionViewDirection,
      normalView,
      { f0: F0, metalness: METALNESS, roughness },
      NO_SIZE
    )
  );
}

function transpiled(lightDirection, roughness) {
  const dotLH = positionViewDirection.dot(lightDirection.add(positionViewDirection).normalize()).clamp();
  return litBy(
    godotDiffuseNL(normalView.dot(lightDirection), normalView.dot(positionViewDirection), dotLH, roughness),
    godotSpecularBRDF(lightDirection, positionViewDirection, normalView, F0, METALNESS, roughness, NO_SIZE)
  );
}

export function run(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const handler = new WebGLNodesHandler();
  handler.getOutputCallback = (output) => output;
  renderer.setNodesHandler(handler);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.z = 3;
  const lightDirection = uniform(new THREE.Vector3(0.5, 0.6, 0.62).normalize());
  const roughness = uniform(0.4);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32));
  const scene = new THREE.Scene();
  scene.add(sphere);
  const drawnWith = (material) => {
    sphere.material = material;
    renderer.render(scene, camera);
    return copyPixels(canvas);
  };
  const byHand = drawnWith(handWritten(lightDirection, roughness));
  return {
    transpiledAgainstHandWritten: imageDelta(byHand, drawnWith(transpiled(lightDirection, roughness))),
  };
}
