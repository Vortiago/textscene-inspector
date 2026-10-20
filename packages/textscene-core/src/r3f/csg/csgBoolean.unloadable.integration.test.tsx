/**
 * The terminal rung of the CSG degradation ladder: with the library unloadable, every contributor
 * un-prunes and draws itself. A file of its own, so the failed import and an empty evaluation
 * cache belong to this module graph alone.
 */

import { describe, expect, it, vi } from 'vitest';
import { drawnMeshes, renderCsgScene, SUBTRACTION } from './testing/csgScene';

vi.mock('three-bvh-csg', () => {
  throw new Error('chunk failed to load');
});

describe('CSG boolean without its library', () => {
  it('degrades to base primitives when the CSG library cannot load', async () => {
    const renderer = await renderCsgScene(SUBTRACTION);

    // Both solids drawn again rather than one merged result, or nothing at all.
    expect(drawnMeshes(renderer)).toHaveLength(2);
    await renderer.unmount();
  });
});
