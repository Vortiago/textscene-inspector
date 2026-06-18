import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { NavigationRegion3D } from './Component';

nodeComponentRegistry.register({ typeName: 'NavigationRegion3D', Component: NavigationRegion3D });

export { NavigationRegion3D };
