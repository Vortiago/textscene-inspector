/**
 * 2D-UI barrel. Imports each Control slice's `index.r3f` for its native
 * (WebGL canvas) painter self-registration (side effect) — the same
 * render-registration entry-point convention as 3D slices (ADR-0001), into
 * ControlComponentRegistry — and re-exports the native mount point the app
 * shell mounts in 2D viewport mode.
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
import '../../nodes/2d/ui/aspectratiocontainer/index.r3f';
import '../../nodes/2d/ui/basebutton/index.r3f';
import '../../nodes/2d/ui/boxcontainer/index.r3f';
import '../../nodes/2d/ui/checkbutton/index.r3f';
import '../../nodes/2d/ui/container/index.r3f';
import '../../nodes/2d/ui/flowcontainer/index.r3f';
import '../../nodes/2d/ui/hflowcontainer/index.r3f';
import '../../nodes/2d/ui/hscrollbar/index.r3f';
import '../../nodes/2d/ui/hseparator/index.r3f';
import '../../nodes/2d/ui/linkbutton/index.r3f';
import '../../nodes/2d/ui/ninepatchrect/index.r3f';
import '../../nodes/2d/ui/progressbar/index.r3f';
import '../../nodes/2d/ui/range/index.r3f';
import '../../nodes/2d/ui/referencerect/index.r3f';
import '../../nodes/2d/ui/splitcontainer/index.r3f';
import '../../nodes/2d/ui/texturebutton/index.r3f';
import '../../nodes/2d/ui/textureprogressbar/index.r3f';
import '../../nodes/2d/ui/vflowcontainer/index.r3f';
import '../../nodes/2d/ui/vscrollbar/index.r3f';
import '../../nodes/2d/ui/vseparator/index.r3f';

export { ControlCanvasLayer } from './native/ControlCanvasLayer';
export { controlComponentRegistry } from './ControlComponentRegistry';
