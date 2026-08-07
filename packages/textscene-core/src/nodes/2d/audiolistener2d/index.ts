/**
 * AudioListener2D registration — parser.
 *
 * Reuses the Node2D parse; AudioListener2D declares no ADD_PROPERTY of its own
 * (audio_listener_2d.cpp:110-114 binds only make_current/clear_current/is_current),
 * so there is no linterParser.ts for it — everything it serialises arrives
 * through the Node2D base-walk. Draws nothing by design (ADR-0008), so
 * index.r3f.ts registers Node2D and its children still land in the right
 * transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const audioListener2DRegistration: NodeTypeRegistration = {
  typeName: 'AudioListener2D',
  parser: parseNode2D,
};

nodeRegistry.register(audioListener2DRegistration);

export { audioListener2DRegistration };
