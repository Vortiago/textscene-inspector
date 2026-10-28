import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Camera3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'Camera3D',
  Component: Camera3D,
  editorIcon: { icon: 'GizmoCamera3D' },
});
