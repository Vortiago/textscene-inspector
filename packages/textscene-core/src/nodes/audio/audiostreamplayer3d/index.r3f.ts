import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { AudioStreamPlayer3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'AudioStreamPlayer3D',
  Component: AudioStreamPlayer3D,
  editorIcon: { icon: 'Gizmo3DSamplePlayer' },
});
