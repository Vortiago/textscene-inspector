/**
 * The UV window a sprite quad's vertices hold, read back off a PlaneGeometry: its bottom-left
 * corner is the offset, and the far corner's distance from it is the repeat.
 * Test-only: the build excludes the `testing/` directories under `src`.
 */
import type * as THREE from 'three';
import type { UvWindow } from '../../../../r3f/uvWindow';

const TOP_RIGHT = 1;
const BOTTOM_LEFT = 2;

export function quadUvWindow(geometry: THREE.BufferGeometry): UvWindow {
  const uvs = geometry.getAttribute('uv');
  const offset = { x: uvs.getX(BOTTOM_LEFT), y: uvs.getY(BOTTOM_LEFT) };
  return {
    offset,
    repeat: { x: uvs.getX(TOP_RIGHT) - offset.x, y: uvs.getY(TOP_RIGHT) - offset.y },
  };
}
