import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { LightmapGI } from './Component';

nodeComponentRegistry.register({
  typeName: 'LightmapGI',
  Component: LightmapGI,
  editorIcon: { icon: 'GizmoLightmapGI' },
});
