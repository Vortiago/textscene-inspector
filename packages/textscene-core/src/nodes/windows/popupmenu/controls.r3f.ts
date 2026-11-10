/**
 * PopupMenu as the root of its own Control canvas: a canvas boundary whose contents minimum, which
 * `wrap_controls` reads, holds its items, painted with the panel and the rows (`PopupMenuChrome.tsx`).
 */

import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { popupMenuTextureSlots } from './menuItems';
import { popupMenuContentsMinimumSize } from './menuLayout';
import { PopupMenuChrome } from './PopupMenuChrome';

controlSolverRegistry.registerCanvasBoundary('PopupMenu');
controlSolverRegistry.registerMinimumSize('PopupMenu', popupMenuContentsMinimumSize);
controlSolverRegistry.registerTextureSlots('PopupMenu', popupMenuTextureSlots);
controlComponentRegistry.register({ typeName: 'PopupMenu', Component: PopupMenuChrome });
