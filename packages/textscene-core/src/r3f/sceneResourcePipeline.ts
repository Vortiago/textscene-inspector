import { useLayoutEffect } from 'react';
import type { Scene } from '../scene/openScene.js';
import { createResourcePipeline, type ResourcePipeline } from '../resources/createResourcePipeline.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import { startBundledWorker } from '../workers/bundledWorker.js';
import { perObject } from '../utils/perObject.js';

/** Written only by {@link adoptLoader}: the scenes a test's own loader serves, read before any is built. */
// eslint-disable-next-line no-restricted-syntax -- a seed the test sets, which no build from the scene makes
const adopted = new WeakMap<Scene, ResourceLoader>();

const NOTHING_HELD = () => () => {};

/** One loader for each scene, so two views share every load. The scene itself imports no three.js. */
export const resourcePipelineOf = perObject((scene: Scene): ResourcePipeline => {
  const testLoader = adopted.get(scene);
  if (testLoader) return { provider: scene.provider, loader: testLoader, hold: NOTHING_HELD };
  return createResourcePipeline(scene.provider, { createWorker: startBundledWorker });
});

/** The scene's loader, held while the view is mounted: a render React drops never watches the provider. */
export function useSceneLoader(scene: Scene): ResourceLoader {
  const pipeline = resourcePipelineOf(scene);
  useLayoutEffect(() => pipeline.hold(), [pipeline]);
  return pipeline.loader;
}

/** Lets `loader`, which a test built, serve `scene`. Call it before any view reads the scene. */
export function adoptLoader(scene: Scene, loader: ResourceLoader): void {
  adopted.set(scene, loader);
}
