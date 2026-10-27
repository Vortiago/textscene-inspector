import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { FogVolume } from './Component';
import { hasGizmoShape } from './Gizmo';
import type { FogVolumeProperties } from './types';

nodeComponentRegistry.register({
  typeName: 'FogVolume',
  Component: FogVolume,
  editorIcon: {
    icon: 'GizmoFogVolume',
    isDrawn: (node) => hasGizmoShape((node.properties as FogVolumeProperties).shape),
  },
});
