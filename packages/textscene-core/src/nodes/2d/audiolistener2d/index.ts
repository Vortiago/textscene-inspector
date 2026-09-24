/**
 * AudioListener2D registration: the parser, which reuses the Node2D parse. The
 * class declares no ADD_PROPERTY (audio_listener_2d.cpp:110-114 binds only
 * make_current/clear_current/is_current). Its one serialised key, `current`, comes
 * from `_get_property_list` and is validated in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const audioListener2DRegistration: NodeTypeRegistration = {
  typeName: 'AudioListener2D',
  parser: parseNode2D,
};

nodeRegistry.register(audioListener2DRegistration);

export { audioListener2DRegistration };
