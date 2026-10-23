/**
 * VisibleOnScreenNotifier3D draws nothing at runtime, so it declares no render intent. Its component
 * draws the editor gizmo of the box it watches for every node (ADR-0056).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { VisibleOnScreenNotifier3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'VisibleOnScreenNotifier3D',
  Component: VisibleOnScreenNotifier3D,
});
