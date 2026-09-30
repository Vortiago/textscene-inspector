/**
 * The web previewer's resource pipeline: its provider, and the job worker in which
 * the loader builds procedural textures.
 */
import { createResourcePipeline, type CreateJobWorker } from '@textscene/core';
import { WebResourceProvider } from './providers/WebResourceProvider';
import { textureWorkerFactory } from './textureWorker/createTextureWorker';

export interface WebPipelineOptions {
  hasFixturesMirror: boolean;
  createWorker?: CreateJobWorker;
}

export function createWebPipeline({
  hasFixturesMirror,
  createWorker = textureWorkerFactory(),
}: WebPipelineOptions) {
  return createResourcePipeline(new WebResourceProvider({ hasFixturesMirror }), { createWorker });
}
