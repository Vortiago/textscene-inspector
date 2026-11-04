/** Scales the intensity of a set of lights for one render, as an exposure scales each Light3D. */

import type * as THREE from 'three';

/**
 * The lights one render scaled and the intensity each held. It reuses its arrays from render to
 * render, so a render allocates nothing.
 *
 * @canonical Scale the intensity of lights and put it back
 */
export class ScaledLights {
  /** Written by `scale`, emptied by `restore`. */
  private readonly lights: THREE.Light[] = [];
  private readonly intensities: number[] = [];

  /** Multiplies the intensity of each of `lights` by `factor`, after it puts back any it scaled. */
  scale(lights: readonly THREE.Light[], factor: number): void {
    this.restore();
    for (const light of lights) {
      this.lights.push(light);
      this.intensities.push(light.intensity);
      light.intensity *= factor;
    }
  }

  /** Puts back the intensity each scaled light held. */
  restore(): void {
    for (let index = 0; index < this.lights.length; index += 1) {
      this.lights[index]!.intensity = this.intensities[index]!;
    }
    this.lights.length = 0;
    this.intensities.length = 0;
  }
}
