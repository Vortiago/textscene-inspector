/** GPUParticlesCollisionHeightField3D draws only its editor gizmo, so the badge reads "not implemented". */

import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { boxVolumeNode } from '../../volume/volumeNode';

nodeComponentRegistry.register({
  typeName: 'GPUParticlesCollisionHeightField3D',
  Component: boxVolumeNode('collision'),
  renderIntent: 'pending',
});
