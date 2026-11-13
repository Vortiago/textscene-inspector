/** MultiMeshInstance3D draws its mesh at every drawn instance of its MultiMesh. */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { MultiMeshInstance3D } from './Component';

nodeComponentRegistry.register({ typeName: 'MultiMeshInstance3D', Component: MultiMeshInstance3D });
