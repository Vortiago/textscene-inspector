import { nodeComponentRegistry } from '../../../NodeComponentRegistry';
import { AudioStreamPlayer3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'AudioStreamPlayer3D',
  Component: AudioStreamPlayer3D,
});

export { AudioStreamPlayer3D };
