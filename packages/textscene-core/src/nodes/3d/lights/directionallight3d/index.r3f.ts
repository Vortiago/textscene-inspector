import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { lightIconModulate } from '../shared/iconModulate';
import { DirectionalLight3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'DirectionalLight3D',
  Component: DirectionalLight3D,
  editorIcon: { icon: 'GizmoDirectionalLight', modulate: lightIconModulate },
});
