import type { Scene } from '../scene/openScene.js';
import { createResourcePipeline, type ResourcePipeline } from '../resources/createResourcePipeline.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import { perObject } from '../utils/perObject.js';

/** Written only by {@link adoptLoader}: the scenes a host's own loader serves, read before any is built. */
// eslint-disable-next-line no-restricted-syntax -- a seed the host sets, which no build from the scene makes
const adopted = new WeakMap<Scene, ResourcePipeline>();

/** One loader for each scene, so two views share every load. The scene itself imports no three.js. */
export const resourcePipelineOf = perObject(
  (scene: Scene): ResourcePipeline => adopted.get(scene) ?? createResourcePipeline(scene.provider)
);

/** Lets `loader`, which a host built, serve `scene`. Call it before any view reads the scene. */
export function adoptLoader(scene: Scene, loader: ResourceLoader): void {
  adopted.set(scene, { provider: scene.provider, loader });
}
