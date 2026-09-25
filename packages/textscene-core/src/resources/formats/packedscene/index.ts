/**
 * PackedScene resource slice, foreign-format kind (ADR-0031): `PackedScene` and `.tscn`
 * route to the `scene` bus slot. The parser is `TscnParser`, as an instanced `.tscn` is a
 * scene, and `processors/createSceneProcessor.ts` keeps the scene-only concerns. Binary
 * `.scn` has no loader, so no slice claims it.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'packedscene',
  kind: 'foreign-format',
  typeNames: ['PackedScene'],
  extensions: ['.tscn'],
  busType: 'scene',
  failureLabel: 'Node instance of scene',
});
