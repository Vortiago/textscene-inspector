/** Reads of a rendered scene that show where a failed load drew its placeholder. */
import type * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** The name of every group in the render, in order. */
export function groupNames(renderer: Renderer): string[] {
  return renderer.scene.findAllByType('Group').map((g) => g.instance.name);
}

/** How many meshes in the render are the magenta placeholder of a failed load. */
export function magentaCount(renderer: Renderer): number {
  return renderer.scene.findAllByType('Mesh').filter((m) => {
    const color = ((m.instance as THREE.Mesh).material as { color?: THREE.Color }).color;
    return color !== undefined && color.r > 0.9 && color.g < 0.1 && color.b > 0.9;
  }).length;
}
