/**
 * `StyleBox` resource slice entry point (ADR-0031): the routing claim plus the
 * decode surface. THREE-free and React-free.
 *
 * The claim names exactly the two box types this slice decodes. Godot's other
 * StyleBoxes (`StyleBoxTexture`, `StyleBoxLine`) have no decode here, so they
 * stay unclaimed rather than resolving to a slice that would silently paint
 * nothing. StyleBoxes reach the overlay as inline `[sub_resource]` theme
 * overrides today; the claim is what lets an external `.tres` box load as a
 * ParsedResource on the generic `resource` slot.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'stylebox',
  kind: 'godot-text',
  typeNames: ['StyleBoxFlat', 'StyleBoxEmpty'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeStyleBox } from './decode';
export type {
  StyleBoxCorners,
  StyleBoxData,
  StyleBoxEmptyData,
  StyleBoxFlatData,
  StyleBoxSides,
} from './types';
