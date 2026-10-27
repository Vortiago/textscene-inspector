import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { lightIconModulate } from '../shared/iconModulate';
import { SpotLight3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'SpotLight3D',
  Component: SpotLight3D,
  editorIcon: { icon: 'GizmoSpotLight', modulate: lightIconModulate },
});
