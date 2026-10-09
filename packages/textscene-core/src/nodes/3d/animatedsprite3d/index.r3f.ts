/**
 * AnimatedSprite3D draws nothing here yet, so the badge reads "not implemented". The GeometryInstance3D
 * base still mounts, for `visible`, the workspace split and the scene cull.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { undrawnGeometryInstance } from '../geometryinstance3d/Component';
import { useAnimatedSprite3DAabb } from './ownAabb';

nodeComponentRegistry.register({
  typeName: 'AnimatedSprite3D',
  Component: undrawnGeometryInstance(useAnimatedSprite3DAabb),
  renderIntent: 'pending',
});
