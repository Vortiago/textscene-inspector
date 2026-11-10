/**
 * PopupPanel as the root of its own Control canvas: its layout fills its panel with each child
 * (`contentLayout.ts`), painted with the panel under them.
 */

import { registerWindowControls } from '../window/registerWindowControls.r3f';
import { popupPanelContentsMinimumSize, popupPanelLayout } from './contentLayout';
import { PopupPanelChrome } from './PopupPanelChrome';

registerWindowControls({
  typeName: 'PopupPanel',
  Component: PopupPanelChrome,
  minimumSize: popupPanelContentsMinimumSize,
  layout: popupPanelLayout,
});
