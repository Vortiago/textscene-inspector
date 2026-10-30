/** GPUParticlesCollisionSDF3D draws only its editor gizmo, so the badge reads "not implemented". */

import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { sdfVolumeNode } from '../../volume/volumeNode';

nodeComponentRegistry.register({
  typeName: 'GPUParticlesCollisionSDF3D',
  Component: sdfVolumeNode(),
  renderIntent: 'pending',
});
