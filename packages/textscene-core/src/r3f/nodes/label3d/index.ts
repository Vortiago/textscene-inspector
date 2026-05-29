import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { Label3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Label3D', Component: Label3D });

export { Label3D };
