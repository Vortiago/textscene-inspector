/** GPUParticlesAttractorSphere3D draws only its editor gizmo, so the badge reads "not implemented". */

import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { sphereVolumeNode } from '../../volume/volumeNode';

nodeComponentRegistry.register({
  typeName: 'GPUParticlesAttractorSphere3D',
  Component: sphereVolumeNode('attractor'),
  renderIntent: 'pending',
});
