/** GPUParticlesAttractorBox3D draws only its editor gizmo, so the badge reads "not implemented". */

import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { boxVolumeNode } from '../../volume/volumeNode';

nodeComponentRegistry.register({
  typeName: 'GPUParticlesAttractorBox3D',
  Component: boxVolumeNode('attractor'),
  renderIntent: 'pending',
});
