import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { DirectionalLight3D } from './Component';

nodeComponentRegistry.register({ typeName: 'DirectionalLight3D', Component: DirectionalLight3D });
