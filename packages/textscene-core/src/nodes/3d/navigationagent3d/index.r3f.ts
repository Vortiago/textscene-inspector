/**
 * NavigationAgent3D renders nothing visible — reuse the base Node component
 * (zero geometry). `container: true`: a plain-Node-derived helper passes
 * through both the 2D and 3D workspaces (see NodeComponentRegistry).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { NavigationAgent3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'NavigationAgent3D',
  Component: NavigationAgent3D,
  container: true,
});

export { NavigationAgent3D };
