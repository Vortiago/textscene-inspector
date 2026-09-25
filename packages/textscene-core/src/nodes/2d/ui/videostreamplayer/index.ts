/**
 * VideoStreamPlayer registration: the parser, which reuses the Control parse. Property knowledge
 * lives in linterParser.ts, and render wiring in `index.r3f.ts`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../control/parser';

const videoStreamPlayerRegistration: NodeTypeRegistration = {
  typeName: 'VideoStreamPlayer',
  parser: parseControl,
};

nodeRegistry.register(videoStreamPlayerRegistration);

export { videoStreamPlayerRegistration };
