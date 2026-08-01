/**
 * PackedScene resource slice — foreign-format kind (ADR-0031).
 *
 * The real parser is `TscnParser` itself: an instanced `.tscn` is a SCENE, not
 * a resource body, so it is scanned by the same lenient parser the top-level
 * scene uses rather than decoded from a **ParsedResource** section. The
 * processor built on it stays at `processors/createSceneProcessor.ts` — the
 * `ResourceLoader` constructs it, and it carries scene-only concerns (metadata
 * id → path resolution, provider-direct loading, the `.glb` synthesised root)
 * that do not belong behind a slice-local entry point.
 *
 * This index is the slice's claim: `PackedScene` and `.tscn` route to the
 * `scene` bus slot. Binary `.scn` has no loader yet and is claimed by nobody.
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
