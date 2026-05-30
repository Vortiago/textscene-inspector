/**
 * 2D-UI overlay barrel. Imports each Control slice's `index.control` for its
 * DOM-component self-registration (side effect), and re-exports the overlay
 * surface the app shell mounts in 2D viewport mode.
 */

import '../../nodes/2d/ui/control/index.control';
import '../../nodes/2d/ui/colorrect/index.control';
import '../../nodes/2d/ui/label/index.control';
import '../../nodes/2d/ui/vboxcontainer/index.control';

export { ControlOverlay } from './ControlOverlay';
export { ControlDispatcher } from './ControlDispatcher';
export { controlComponentRegistry } from './ControlComponentRegistry';
export type { ControlComponentProps } from './ControlComponentRegistry';
