/**
 * Skeleton2D draws nothing of its own. Its component drives the bones: it runs the modification
 * stack on them each render and owns the pose its Polygon2Ds skin with (ADR-0045).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Skeleton2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'Skeleton2D',
  Component: Skeleton2D,
  canvasItem: true,
  renderIntent: 'transform-only',
});
