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
import '../../nodes/2d/ui/hboxcontainer/index.r3f';
import '../../nodes/2d/ui/hsplitcontainer/index.r3f';
import '../../nodes/2d/ui/vsplitcontainer/index.r3f';
import '../../nodes/2d/ui/gridcontainer/index.r3f';
import '../../nodes/2d/ui/centercontainer/index.r3f';
import '../../nodes/2d/ui/margincontainer/index.r3f';
import '../../nodes/2d/ui/scrollcontainer/index.r3f';
import '../../nodes/2d/ui/panel/index.r3f';
import '../../nodes/2d/ui/panelcontainer/index.r3f';
import '../../nodes/2d/ui/subviewportcontainer/index.r3f';
import '../../nodes/2d/ui/button/index.r3f';
import '../../nodes/2d/ui/checkbox/index.r3f';
import '../../nodes/2d/ui/optionbutton/index.r3f';
import '../../nodes/2d/ui/lineedit/index.r3f';
import '../../nodes/2d/ui/hslider/index.r3f';
import '../../nodes/2d/ui/vslider/index.r3f';
import '../../nodes/2d/ui/texturerect/index.r3f';
import '../../nodes/2d/ui/richtextlabel/index.r3f';
import '../../nodes/2d/ui/canvaslayer/index.r3f';

export { ControlOverlay } from './ControlOverlay';
export { ControlDispatcher } from './ControlDispatcher';
export { controlComponentRegistry } from './ControlComponentRegistry';
export type { ControlComponentProps } from './ControlComponentRegistry';
