import type { Scene } from '../scene/openScene.js';
import { createResourcePipeline, type ResourcePipeline } from '../resources/createResourcePipeline.js';
import { perObject } from '../utils/perObject.js';

/** One loader for each scene, so two views share every load. The scene itself imports no three.js. */
export const resourcePipelineOf = perObject((scene: Scene): ResourcePipeline =>
  createResourcePipeline(scene.provider)
);
