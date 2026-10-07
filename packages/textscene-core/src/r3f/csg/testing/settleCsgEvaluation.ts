/**
 * Waits until a mounted CSG root's evaluated result lands. The library arrives
 * through a dynamic import and the status publishes from a `.then`, so one
 * macrotask tick races the evaluation under load. Test-only: the build excludes
 * the `testing/` directories under `src`.
 */
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { loadCsgModule } from '../csgModule';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Ticks after which a root with nothing to prune counts as settled. */
const TICKS_WITHOUT_CONTRIBUTORS = 4;
const MAX_TICKS = 20;

export async function settleCsgEvaluation(renderer: Renderer): Promise<void> {
  // The same memoised promise the component awaits, so the module is resident first.
  await loadCsgModule().catch(() => undefined);
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    await ReactThreeTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (hasBoundsProxy(renderer) || tick + 1 >= TICKS_WITHOUT_CONTRIBUTORS) return;
  }
}

/** A bounds proxy exists once the evaluated result has pruned the contributors. */
function hasBoundsProxy(renderer: Renderer): boolean {
  return renderer.scene
    .findAllByType('Mesh')
    .some((m) => (m.instance as unknown as THREE.Mesh).userData?.tscnBoundsProxy === true);
}
