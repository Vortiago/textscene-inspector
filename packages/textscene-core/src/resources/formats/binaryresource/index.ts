/**
 * Binary resource slice, foreign-format kind (ADR-0031): Godot's `RSRC` container, read by
 * `parse.ts` into the **ParsedResource** a `.tres` gives, on the generic `resource` bus slot. It
 * claims the extension only: the type a binary file holds decodes in its own Godot-text slice.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'binaryresource',
  kind: 'foreign-format',
  typeNames: [],
  // A LightmapGI bake, the one binary resource a consumer here decodes.
  extensions: ['.lmbake'],
  binaryBytes: true,
  busType: 'resource',
});
