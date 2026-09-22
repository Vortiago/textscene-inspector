/**
 * Range registration — the native (WebGL canvas) painter. No solver: Range
 * overrides neither `get_minimum_size` nor any container layout in Godot, so
 * absence is the correct port (this slice's `Component.tsx` module doc).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Range } from './Component';

controlComponentRegistry.register({ typeName: 'Range', Component: Range });

export { Range };
