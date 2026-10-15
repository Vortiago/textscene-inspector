/**
 * FogMaterial resource slice (ADR-0031): the routing claim and the decode surface. THREE-free, so
 * the linter can import it.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'fogmaterial',
  kind: 'godot-text',
  typeNames: ['FogMaterial'],
  busType: 'resource',
});
