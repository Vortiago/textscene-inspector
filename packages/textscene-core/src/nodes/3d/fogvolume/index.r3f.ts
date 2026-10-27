import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { FogVolume } from './Component';
import { fogVolumeHasGizmo } from '../../../godot/rendering/environment/fogVolume';
import type { FogVolumeProperties } from './types';

nodeComponentRegistry.register({
  typeName: 'FogVolume',
  Component: FogVolume,
  editorIcon: {
    icon: 'GizmoFogVolume',
    isDrawn: (node) => fogVolumeHasGizmo((node.properties as FogVolumeProperties).shape),
  },
});
