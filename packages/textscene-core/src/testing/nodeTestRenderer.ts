import { installNodesHandler } from '../shaders/nodesHandler.js';
import { testRenderer } from './recordingWebGL.js';

export async function nodeTestRenderer(): ReturnType<typeof testRenderer> {
  const recorded = await testRenderer();
  installNodesHandler(recorded.renderer, 'linear');
  return recorded;
}
