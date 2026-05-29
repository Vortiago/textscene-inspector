import { nodeComponentRegistry } from '../../../NodeComponentRegistry';
import { OmniLight3D } from './Component';

nodeComponentRegistry.register({ typeName: 'OmniLight3D', Component: OmniLight3D });

export { OmniLight3D };
