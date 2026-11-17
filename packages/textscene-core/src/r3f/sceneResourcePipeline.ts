import type { Scene } from '../scene/openScene.js';
import { createResourcePipeline, type ResourcePipeline } from '../resources/createResourcePipeline.js';
import { perObject } from '../utils/perObject.js';

/**
 * The resource loader of an open scene, one for the scene, so two views of it share every load.
 * It lives outside the scene, since the loader builds three.js objects and the scene imports none.
 */
export const resourcePipelineOf = perObject((scene: Scene): ResourcePipeline =>
  createResourcePipeline(scene.provider)
);
