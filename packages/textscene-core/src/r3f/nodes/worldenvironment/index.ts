import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { WorldEnvironment } from './Component';

nodeComponentRegistry.register({ typeName: 'WorldEnvironment', Component: WorldEnvironment });

export { WorldEnvironment };
