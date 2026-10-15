/**
 * `StyleBox` resource slice entry point (ADR-0031): the routing claim. THREE-free
 * and React-free. It claims `StyleBoxFlat` and `StyleBoxEmpty`, and lets an
 * external `.tres` box load on the `resource` slot.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'stylebox',
  kind: 'godot-text',
  typeNames: ['StyleBoxFlat', 'StyleBoxEmpty'],
  busType: 'resource',
});
