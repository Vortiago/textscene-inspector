/**
 * VisibleOnScreenEnabler3D draws nothing at runtime, so it declares no render intent. It mounts its
 * base class's component, which draws the editor gizmo of the watched box while selected (ADR-0018).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { VisibleOnScreenNotifier3D } from '../visibleonscreennotifier3d/Component';

nodeComponentRegistry.register({
  typeName: 'VisibleOnScreenEnabler3D',
  Component: VisibleOnScreenNotifier3D,
});
