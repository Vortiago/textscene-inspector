/**
 * Waits until a mounted CSG root's evaluated result lands. The library arrives
 * through a dynamic import and the status publishes from a `.then`, so one
 * macrotask tick races the evaluation under load. Test-only: the build excludes
 * the `testing/` directories under `src`.
 */
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { loadCsgModule } from '../csgModule';
import { instanceAs } from '../../../nodes/3d/testing/reactThreeTestInstance';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/**
 * A root with nothing to prune never shows a bounds proxy, so the wait ends here
 * for it. A proxy left by an earlier evaluation ends the wait after one tick.
 */
const MAX_TICKS = 4;

export async function settleCsgEvaluation(renderer: Renderer): Promise<void> {
  // The same memoised promise the component awaits, so the module is resident first.
  await loadCsgModule().catch(() => undefined);
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    await ReactThreeTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (hasBoundsProxy(renderer)) return;
  }
}

/** A bounds proxy exists once the evaluated result has pruned the contributors. */
function hasBoundsProxy(renderer: Renderer): boolean {
  return renderer.scene
    .findAllByType('Mesh')
    .some((m) => instanceAs<THREE.Mesh>(m).userData?.tscnBoundsProxy === true);
}
