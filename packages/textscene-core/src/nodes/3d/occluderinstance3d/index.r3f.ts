/**
 * OccluderInstance3D draws nothing of its own (ADR-0008). Its component mounts the AABB of the
 * occluder and keeps the children in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { OccluderInstance3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'OccluderInstance3D',
  Component: OccluderInstance3D,
  renderIntent: 'transform-only',
});
