/**
 * VideoStreamPlayer registration: the parser, which adds `stream` and `expand` to the Control parse. Property knowledge
 * lives in linterParser.ts, and render wiring in `index.r3f.ts`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVideoStreamPlayer } from './parser';

const videoStreamPlayerRegistration: NodeTypeRegistration = {
  typeName: 'VideoStreamPlayer',
  parser: parseVideoStreamPlayer,
};

nodeRegistry.register(videoStreamPlayerRegistration);
