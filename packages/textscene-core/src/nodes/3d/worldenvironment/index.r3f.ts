import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { WorldEnvironment } from './Component';

nodeComponentRegistry.register({ typeName: 'WorldEnvironment', Component: WorldEnvironment });

export { WorldEnvironment };
