/**
 * PopupMenu as the root of its own Control canvas: its contents minimum holds its items, and
 * `PopupMenuChrome.tsx` paints the panel and the rows.
 */

import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { registerWindowControls } from '../window/registerWindowControls.r3f';
import { popupMenuTextureSlots } from './menuItems';
import { popupMenuContentsMinimumSize, popupMenuLoadedMinimumSize } from './menuLayout';
import { PopupMenuChrome } from './PopupMenuChrome';

registerWindowControls({
  typeName: 'PopupMenu',
  Component: PopupMenuChrome,
  minimumSize: popupMenuContentsMinimumSize,
  loadedMinimumSize: popupMenuLoadedMinimumSize,
});
controlSolverRegistry.registerTextureSlots('PopupMenu', popupMenuTextureSlots);
