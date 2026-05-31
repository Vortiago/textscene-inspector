/**
 * 2D-UI overlay barrel. Imports each Control slice's `index.r3f` for its
 * DOM-component self-registration (side effect) — the same render-registration
 * entry-point convention as 3D slices (ADR-0001), into ControlComponentRegistry
 * — and re-exports the overlay surface the app shell mounts in 2D viewport mode.
 */

import '../../nodes/2d/ui/control/index.r3f';
import '../../nodes/2d/ui/colorrect/index.r3f';
import '../../nodes/2d/ui/label/index.r3f';
import '../../nodes/2d/ui/vboxcontainer/index.r3f';

export { ControlOverlay } from './ControlOverlay';
export { ControlDispatcher } from './ControlDispatcher';
export { controlComponentRegistry } from './ControlComponentRegistry';
export type { ControlComponentProps } from './ControlComponentRegistry';
