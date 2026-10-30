import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { lightIconModulate } from '../shared/iconModulate';
import { OmniLight3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'OmniLight3D',
  Component: OmniLight3D,
  editorIcon: { icon: 'GizmoLight', modulate: lightIconModulate },
});
