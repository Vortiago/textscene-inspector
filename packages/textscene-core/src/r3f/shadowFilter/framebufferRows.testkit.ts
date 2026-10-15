/** The framebuffer height as the soft shadow filter reads it, through the uniform the install gives. */

import * as THREE from 'three';
import { FRAMEBUFFER_HEIGHT_UNIFORM, installFramebufferHeightUniform } from './framebufferRows';

/** The one buffer every lit material reads the height from. It installs the uniform first. */
export function installedFramebufferHeight(): Float32Array {
  installFramebufferHeightUniform();
  const lights = THREE.UniformsLib.lights as Record<string, THREE.IUniform>;
  return lights[FRAMEBUFFER_HEIGHT_UNIFORM]!.value as Float32Array;
}
