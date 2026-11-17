import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'cubemap',
  kind: 'godot-text',
  typeNames: ['Cubemap'],
  busType: 'resource',
});
