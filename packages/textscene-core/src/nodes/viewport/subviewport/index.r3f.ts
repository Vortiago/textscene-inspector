import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { SubViewport } from './Component';

nodeComponentRegistry.register({ typeName: 'SubViewport', Component: SubViewport });

export { SubViewport };
