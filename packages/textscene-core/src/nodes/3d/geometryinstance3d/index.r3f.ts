/**
 * GeometryInstance3D draws nothing of its own (ADR-0008). Its component mounts the Node3D
 * transform, so its children land in the right space, and its place in the scene cull.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { GeometryInstance3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'GeometryInstance3D',
  Component: GeometryInstance3D,
  renderIntent: 'transform-only',
});
