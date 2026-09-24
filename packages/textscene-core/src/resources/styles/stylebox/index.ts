/**
 * `StyleBox` resource slice entry point (ADR-0031): the routing claim and the
 * decode surface. THREE-free and React-free. It claims only the two types it
 * decodes, and lets an external `.tres` box load on the `resource` slot.
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
