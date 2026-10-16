/** The debanding scale of the radiance octmaps a bake draws, read at each draw as the pass is reused. */

import * as THREE from 'three';
import { vi } from 'vitest';

/** The debanding scale of each radiance octmap `renderer` draws while `bake` runs. */
export function debandingDrawnBy(renderer: THREE.WebGLRenderer, bake: () => void): number[] {
  const drawn: number[] = [];
  const render = renderer.render.bind(renderer);
  // A cube camera renders a scene, which has no material.
  vi.spyOn(renderer, 'render').mockImplementation((object, camera) => {
    const uniforms = ((object as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (uniforms?.['radiance']) drawn.push(uniforms['debanding']!.value as number);
    render(object, camera);
  });
  bake();
  return drawn;
}
